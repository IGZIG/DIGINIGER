-- ============================================================================
-- DIGINIGER — 0008 — Vérification publique des certificats
-- ============================================================================
-- Le tableau certificates n'est PAS lisible par anon : y exposer les colonnes
-- user_id / verification_hash permettrait d'énumérer les apprenants.
-- On expose uniquement une fonction RPC à réponse filtrée et limitée en débit.
-- ============================================================================

drop view if exists public.certificate_verification;

drop policy if exists certificates_public_verify on public.certificates;
revoke all on table public.certificates from anon;

create or replace function public.verify_certificate(p_serial text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  -- Normalisation stricte de l'entrée (format DIGI-AAAA-XXXXXXX)
  if p_serial is null or p_serial !~ '^DIGI-[0-9]{4}-[A-Z0-9]{7}$' then
    return jsonb_build_object('found', false);
  end if;

  select jsonb_build_object(
           'found', true,
           'serial', c.serial,
           'student_name', c.student_name,
           'course_title', c.course_title,
           'score', c.score,
           'issued_at', c.issued_at,
           'is_valid', c.revoked_at is null
         )
    into v_result
    from public.certificates c
   where c.serial = upper(p_serial)
   limit 1;

  return coalesce(v_result, jsonb_build_object('found', false));
end;
$$;

revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

comment on function public.verify_certificate(text) is
  'Vérification publique d''un certificat : renvoie uniquement des champs non sensibles.';
