-- ============================================================================
-- DIGINIGER — 0002 — Identités, rôles et helpers de sécurité
-- ============================================================================
-- Principe : aucune autorisation n'est décidée côté client. Les helpers
-- ci-dessous sont SECURITY DEFINER + STABLE et n'exposent jamais de données :
-- ils répondent uniquement à « ce user a-t-il le rôle X ? ».
-- search_path est figé pour empêcher toute attaque par détournement de schéma.
-- ============================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text not null default '',
  phone         text,
  country       text default 'NE',
  city          text,
  bio           text,
  avatar_url    text,
  locale        text not null default 'fr' check (locale in ('fr', 'en')),
  role          public.user_role not null default 'student',
  is_verified   boolean not null default false,
  onboarded_at  timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Profil applicatif de chaque utilisateur Supabase Auth. Le rôle est la seule source d''autorisation.';

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Helpers d'autorisation
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()),
    'student'::public.user_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'instructor')
  );
$$;

-- ---------------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, phone, locale)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'fr')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Le rôle ne peut jamais être modifié par le client : il est protégé par les
-- politiques RLS (aucune politique UPDATE n'autorise la colonne role).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Modification du rôle interdite' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role_trg on public.profiles;
create trigger guard_profile_role_trg
  before update on public.profiles
  for each row execute function public.guard_profile_role();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
