-- ============================================================================
-- DIGINIGER — 0012 — Correctifs de sécurité et de génération de certificat
-- ============================================================================
-- Bug 1 : is_trusted_context() utilisait current_user. Dans une fonction
--         SECURITY DEFINER, current_user devient le propriétaire de la fonction
--         (postgres) : TOUT appel était donc considéré comme « de confiance »,
--         ce qui laissait un apprenant s'attribuer le rôle admin.
--         Correctif : session_user (qui reste 'authenticator' via PostgREST et
--         'postgres' seulement pour une connexion directe) + auth.role().
--
-- Bug 2 : chez Supabase, pgcrypto est installé dans le schéma `extensions`.
--         L'appel digest(...) échouait avec search_path = public, pg_temp.
--         Correctif : schéma explicitement qualifié + extensions dans le
--         search_path des fonctions concernées.
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
    or session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin');
$$;

comment on function public.is_trusted_context() is
  'Contexte de confiance : service_role ou connexion directe postgres. N''utilise jamais current_user (faussé par SECURITY DEFINER).';

-- Re-création du garde-fou avec la bonne primitive
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

-- ---------------------------------------------------------------------------
-- Émission du certificat : digest correctement qualifié
-- ---------------------------------------------------------------------------
create or replace function public.issue_certificate(p_course_id uuid)
returns public.certificates
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_cert public.certificates;
  v_enrollment public.enrollments;
  v_course public.courses;
  v_profile public.profiles;
  v_failed_exams integer;
  v_existing public.certificates;
  v_serial text;
  v_avg_score integer;
  v_token text;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_existing from public.certificates
   where user_id = v_user and course_id = p_course_id and revoked_at is null;
  if v_existing.id is not null then
    return v_existing;
  end if;

  select * into v_enrollment from public.enrollments
   where user_id = v_user and course_id = p_course_id;
  if v_enrollment.id is null then
    raise exception 'NOT_ENROLLED' using errcode = '42501';
  end if;

  if v_enrollment.progress_pct < 100 then
    raise exception 'COURSE_NOT_COMPLETED' using errcode = 'P0006';
  end if;

  select count(*) into v_failed_exams
    from public.exercises e
   where e.course_id = p_course_id
     and e.is_published
     and e.is_exam
     and not exists (
       select 1 from public.attempts a
        where a.exercise_id = e.id
          and a.user_id = v_user
          and a.status = 'graded'
          and a.score >= e.pass_score
     );

  if v_failed_exams > 0 then
    raise exception 'EXAM_NOT_PASSED' using errcode = 'P0007';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  select * into v_profile from public.profiles where id = v_user;

  select round(avg(score)) into v_avg_score
    from public.attempts
   where user_id = v_user and course_id = p_course_id and score is not null;

  v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
  v_serial := format('DIGI-%s-%s', to_char(now(), 'YYYY'), v_token);

  insert into public.certificates (
    serial, user_id, course_id, student_name, course_title, score, verification_hash
  )
  values (
    v_serial, v_user, p_course_id,
    coalesce(nullif(v_profile.full_name, ''), 'Apprenant DIGINIGER'),
    v_course.title_fr,
    v_avg_score,
    encode(extensions.digest(v_serial || v_user::text || p_course_id::text, 'sha256'), 'hex')
  )
  returning * into v_cert;

  perform public.log_audit('certificate.issued', 'certificates', v_cert.id::text,
                           jsonb_build_object('serial', v_serial, 'course_id', p_course_id));

  return v_cert;
end;
$$;

revoke all on function public.issue_certificate(uuid) from public;
grant execute on function public.issue_certificate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Remise à zéro du rôle du compte de démonstration altéré par le test
-- (aucun autre compte n'est concerné).
-- ---------------------------------------------------------------------------
update public.profiles
   set role = 'student'
 where email = 'etudiant.demo@diginiger.test'
   and role <> 'student';
