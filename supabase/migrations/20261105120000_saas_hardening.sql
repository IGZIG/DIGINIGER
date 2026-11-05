-- ===========================================================================
-- Durcissement « abonnements + règlements vérifiés »
-- ===========================================================================
-- Faille corrigée
-- ---------------
-- La politique RLS `subscriptions_update_self` autorisait un apprenant à
-- modifier SA ligne d'abonnement, toutes colonnes comprises. Un utilisateur
-- connecté pouvait donc appeler l'API REST Supabase et écrire :
--     update subscriptions set plan_id = <premium>  where id = <le sien>
-- soit un passage à l'offre la plus chère sans aucun paiement.
-- Vérifié en base avant correction : la mise à jour réussissait.
--
-- Correctif : la politique reste permissive (un apprenant doit pouvoir
-- demander l'arrêt du renouvellement), mais un déclencheur interdit toute
-- modification des colonnes qui portent de l'argent ou un droit d'accès.
-- Seule `cancel_at_period_end` (et son horodatage) reste modifiable par
-- l'apprenant. L'administration et le service_role (server actions
-- journalisées) ne sont pas contraints.
-- ===========================================================================

create or replace function public.guard_subscription_self_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claims text;
  v_role   text;
begin
  -- ATTENTION : cette fonction est SECURITY DEFINER, donc `current_user`
  -- vaut son propriétaire (postgres) et ne dit RIEN du visiteur.
  -- On lit donc le jeton de la requête, seul témoin fiable du rôle réel.
  v_claims := nullif(current_setting('request.jwt.claims', true), '');

  -- 1. Aucun jeton : accès direct à la base (migrations, scripts, seed,
  --    tâches d'exploitation). On laisse passer.
  if v_claims is null then
    return new;
  end if;

  v_role := coalesce(
    auth.role(),
    (v_claims::jsonb ->> 'role')
  );

  -- 2. Clé service_role (server actions d'administration, webhooks de
  --    paiement, réconciliation) ou administrateur vérifié : on laisse passer.
  if coalesce(v_role, '') = 'service_role'
     or coalesce(public.is_admin(), false)
  then
    return new;
  end if;

  -- Liste blanche : côté apprenant, SEUL l'arrêt du renouvellement est
  -- modifiable. Toute autre différence entre l'ancienne et la nouvelle ligne
  -- (offre, statut, période, fournisseur, référence de paiement, ou toute
  -- colonne ajoutée plus tard) est refusée. On compare la ligne entière pour
  -- ne pas dépendre du nom des colonnes.
  if (to_jsonb(new) - 'cancel_at_period_end' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'cancel_at_period_end' - 'updated_at')
  then
    raise exception 'SUBSCRIPTION_IMMUTABLE: seul l''arrêt du renouvellement peut être demandé par l''apprenant'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_subscription_self_update() from public, anon;

drop trigger if exists trg_guard_subscription_self_update on public.subscriptions;
create trigger trg_guard_subscription_self_update
  before update on public.subscriptions
  for each row
  execute function public.guard_subscription_self_update();

comment on function public.guard_subscription_self_update() is
  'Empêche un apprenant de modifier l''offre, le statut ou la période de son abonnement via l''API REST.';

-- ---------------------------------------------------------------------------
-- Rappel explicite : la RLS active doit rester en place sur les tables
-- financières. On la réaffirme (idempotent) pour qu'une restauration de
-- sauvegarde partielle ne puisse pas la désactiver silencieusement.
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.refunds enable row level security;
alter table public.promo_codes enable row level security;
alter table public.plans enable row level security;

-- ---------------------------------------------------------------------------
-- Index utiles à l'écran d'administration (volumes qui vont croître).
-- ---------------------------------------------------------------------------
create index if not exists idx_subscriptions_status on public.subscriptions (status);
create index if not exists idx_subscriptions_user on public.subscriptions (user_id);
create index if not exists idx_transactions_status_created
  on public.transactions (status, created_at desc);
create index if not exists idx_transactions_user on public.transactions (user_id);
create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity, entity_id);
