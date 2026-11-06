-- ===========================================================================
-- Aucun nom de personne sur les certificats
-- ---------------------------------------------------------------------------
-- Le certificat ne porte plus que le RÔLE du responsable (« Le Directeur »,
-- « La Directrice ») et une ligne à signer à la main. Les noms enregistrés
-- jusqu'ici sont effacés, et l'émission ne les copie plus.
-- ===========================================================================

update public.certificates set director_name = null where director_name is not null;
update public.schools set director_name = null where director_name is not null;

create or replace function public.issue_certificate(p_course_id uuid)
returns public.certificates
language plpgsql
security definer
set search_path = public, pg_temp
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
  v_school public.schools;
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

  -- Examens obligatoires non réussis ?
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
  select * into v_school from public.schools where id = v_course.school_id;
  select * into v_profile from public.profiles where id = v_user;

  select round(avg(score)) into v_avg_score
    from public.attempts
   where user_id = v_user and course_id = p_course_id and score is not null;

  v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));
  v_serial := format('DIGI-%s-%s', to_char(now(), 'YYYY'), v_token);

  insert into public.certificates (
    serial, user_id, course_id, student_name, course_title, score, verification_hash,
    school_name, school_tagline, school_accent, director_role
  )
  values (
    v_serial, v_user, p_course_id,
    coalesce(nullif(v_profile.full_name, ''), 'Apprenant DIGINIGER'),
    v_course.title_fr,
    v_avg_score,
    encode(digest(v_serial || v_user::text || p_course_id::text, 'sha256'), 'hex'),
    v_school.name_fr,
    v_school.tagline_fr,
    v_school.accent,
    coalesce(nullif(v_school.director_role, ''), 'Directeur')
  )
  returning * into v_cert;

  perform public.log_audit('certificate.issued', 'certificates', v_cert.id::text,
                           jsonb_build_object('serial', v_serial, 'course_id', p_course_id));

  return v_cert;
end;
$$;



