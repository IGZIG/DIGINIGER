-- ============================================================================
-- DIGINIGER — 0011 — Contexte de confiance pour la modification des rôles
-- ============================================================================
-- Le trigger guard_profile_role empêchait TOUT changement de rôle sans session
-- administrateur, y compris pour les scripts d'administration et le
-- service_role. On autorise explicitement les seuls contextes de confiance :
--   * une session administrateur (is_admin()) ;
--   * le rôle JWT service_role (API serveur, jamais exposé au navigateur) ;
--   * une connexion directe postgres / supabase_admin (migrations, scripts).
-- Tout client authentifié classique reste bloqué.
-- ============================================================================

create or replace function public.is_trusted_context()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(auth.role() = 'service_role', false)
    or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin');
$$;

revoke all on function public.is_trusted_context() from public;
grant execute on function public.is_trusted_context() to authenticated, anon;

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and not public.is_trusted_context() then
    raise exception 'Modification du rôle interdite' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Même logique pour la vérification d'email (réservée au service).
create or replace function public.guard_profile_verified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_verified is distinct from old.is_verified
     and not public.is_trusted_context() then
    raise exception 'Modification de la vérification interdite' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_verified_trg on public.profiles;
create trigger guard_profile_verified_trg
  before update on public.profiles
  for each row execute function public.guard_profile_verified();
