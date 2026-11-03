-- ============================================================================
-- DIGINIGER — 0005 — Monétisation : offres, abonnements, paiements, promos
-- ============================================================================
-- Règles non négociables :
--  * Aucun montant n'est accepté depuis le client. Il est toujours recalculé
--    côté serveur à partir de public.plans / public.courses.
--  * Une transaction ne passe à 'paid' que via le webhook signé du fournisseur
--    (service_role), jamais via une requête utilisateur.
-- ============================================================================

create table if not exists public.plans (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name_fr        text not null,
  name_en        text not null,
  description_fr text not null default '',
  description_en text not null default '',
  audience       public.plan_audience not null default 'individual',
  price_xof      integer not null default 0 check (price_xof >= 0),
  interval       public.billing_interval not null default 'month',
  features_fr    text[] not null default '{}',
  features_en    text[] not null default '{}',
  ai_messages_per_day integer not null default 0,
  course_access  text not null default 'free' check (course_access in ('free', 'all', 'premium')),
  is_featured    boolean not null default false,
  is_active      boolean not null default true,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  plan_id           uuid not null references public.plans (id) on delete restrict,
  status            public.subscription_status not null default 'active',
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at       timestamptz,
  provider          public.payment_provider,
  provider_ref      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id, status);
-- Un seul abonnement actif par utilisateur et par offre
create unique index if not exists subscriptions_one_active_idx
  on public.subscriptions (user_id)
  where status in ('active', 'trialing', 'past_due');

create table if not exists public.promo_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  kind          public.promo_kind not null default 'percent',
  value         integer not null check (value > 0),
  max_redemptions integer not null default 100,
  times_redeemed integer not null default 0,
  per_user_limit integer not null default 1,
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,
  plans_allowed uuid[] not null default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint percent_bounds check (kind <> 'percent' or value between 1 and 100),
  constraint redemption_bounds check (times_redeemed <= max_redemptions)
);

create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  reference      text not null unique,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  plan_id        uuid references public.plans (id) on delete set null,
  course_id      uuid references public.courses (id) on delete set null,
  promo_code_id  uuid references public.promo_codes (id) on delete set null,
  amount_xof     integer not null check (amount_xof >= 0),
  discount_xof   integer not null default 0 check (discount_xof >= 0),
  total_xof      integer not null check (total_xof >= 0),
  currency       text not null default 'XOF',
  provider       public.payment_provider not null default 'mobile_money',
  provider_ref   text,
  status         public.transaction_status not null default 'pending',
  metadata       jsonb not null default '{}'::jsonb,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);
create index if not exists transactions_provider_ref_idx on public.transactions (provider_ref);
create unique index if not exists transactions_provider_ref_unique
  on public.transactions (provider, provider_ref)
  where provider_ref is not null;

create table if not exists public.payment_events (
  id           uuid primary key default gen_random_uuid(),
  provider     public.payment_provider not null,
  event_id     text not null,
  event_type   text not null,
  signature_ok boolean not null default false,
  payload      jsonb not null,
  processed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  -- Idempotence : un même événement fournisseur n'est traité qu'une seule fois.
  unique (provider, event_id)
);

create table if not exists public.refunds (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  amount_xof     integer not null check (amount_xof > 0),
  reason         text not null default '',
  status         public.refund_status not null default 'requested',
  processed_by   uuid references public.profiles (id) on delete set null,
  processed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.application_requests (
  id           uuid primary key default gen_random_uuid(),
  kind         public.application_kind not null,
  user_id      uuid references public.profiles (id) on delete set null,
  full_name    text not null,
  email        text not null,
  phone        text,
  organisation text,
  subject      text,
  payload      jsonb not null default '{}'::jsonb,
  status       public.application_status not null default 'new',
  admin_note   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists application_requests_kind_idx on public.application_requests (kind, status);

-- ---------------------------------------------------------------------------
-- Utilitaires métier
-- ---------------------------------------------------------------------------

-- Applique un code promo et renvoie la remise en FCFA (0 si invalide).
create or replace function public.promo_discount(p_code text, p_plan_id uuid, p_amount integer)
returns table (promo_id uuid, discount integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pc.id,
         case pc.kind
           when 'percent' then floor(p_amount * pc.value / 100.0)::integer
           else least(pc.value, p_amount)
         end
  from public.promo_codes pc
  where upper(pc.code) = upper(p_code)
    and pc.is_active
    and now() between pc.starts_at and coalesce(pc.ends_at, 'infinity')
    and pc.times_redeemed < pc.max_redemptions
    and (array_length(pc.plans_allowed, 1) is null or p_plan_id = any (pc.plans_allowed))
  limit 1;
$$;

revoke all on function public.promo_discount(text, uuid, integer) from public;
grant execute on function public.promo_discount(text, uuid, integer) to service_role;

-- Active un abonnement après confirmation de paiement (appelée par le webhook).
create or replace function public.activate_subscription(
  p_user_id uuid,
  p_plan_id uuid,
  p_provider public.payment_provider,
  p_provider_ref text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.plans;
  v_sub_id uuid;
  v_end timestamptz;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if v_plan.id is null then
    raise exception 'Offre inconnue';
  end if;

  v_end := case v_plan.interval
    when 'year' then now() + interval '1 year'
    when 'month' then now() + interval '1 month'
    else null
  end;

  -- Remplace l'abonnement en cours (une seule ligne active par utilisateur)
  update public.subscriptions
     set status = 'expired', updated_at = now()
   where user_id = p_user_id and status in ('active', 'trialing', 'past_due');

  insert into public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end, provider, provider_ref)
  values (p_user_id, p_plan_id, 'active', now(), v_end, p_provider, p_provider_ref)
  returning id into v_sub_id;

  return v_sub_id;
end;
$$;

revoke all on function public.activate_subscription(uuid, uuid, public.payment_provider, text) from public;
grant execute on function public.activate_subscription(uuid, uuid, public.payment_provider, text) to service_role;

-- Offre active d'un utilisateur (utilisée par le contrôle d'accès).
create or replace function public.my_active_plan()
returns table (
  plan_id uuid, code text, name_fr text, name_en text,
  course_access text, ai_messages_per_day integer, current_period_end timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.code, p.name_fr, p.name_en, p.course_access, p.ai_messages_per_day, s.current_period_end
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = auth.uid()
    and s.status in ('active', 'trialing')
    and (s.current_period_end is null or s.current_period_end > now())
  limit 1;
$$;

grant execute on function public.my_active_plan() to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['plans', 'subscriptions', 'promo_codes', 'transactions', 'application_requests']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;
