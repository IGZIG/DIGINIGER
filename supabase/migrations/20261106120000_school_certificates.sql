-- ===========================================================================
-- Certificats : identité de l'école émettrice
-- ---------------------------------------------------------------------------
-- Chaque certificat porte désormais l'école qui délivre la formation :
-- son nom, son slogan, sa couleur et la signature de son directeur.
-- Ces informations sont COPIÉES au moment de l'émission : un certificat déjà
-- délivré ne change pas si l'école est renommée plus tard.
-- ===========================================================================

-- 1. Responsable de chaque école (modifiable depuis l'administration).
alter table public.schools
  add column if not exists director_name text,
  add column if not exists director_role text not null default 'Directeur';

update public.schools
   set director_name = v.director_name,
       director_role = v.director_role
  from (values
    ('agriculture-agro-industry',   'Dr Mahamane Ousmane',   'Directeur'),
    ('ai-technology',               'Mme Aissatou Abdou',    'Directrice'),
    ('business-entrepreneurship',   'M. Ousseini Tinni',     'Directeur'),
    ('finance-accounting',          'Mme Ramatou Souley',    'Directrice'),
    ('industry-technical-trades',   'M. Ibrahim Natatou',    'Directeur'),
    ('marketing-commerce',          'Mme Fatou Zara Seyni',  'Directrice')
  ) as v(slug, director_name, director_role)
 where public.schools.slug = v.slug
   and public.schools.director_name is null;

-- 2. Identité de l'école figée sur le certificat.
alter table public.certificates
  add column if not exists school_name     text,
  add column if not exists school_tagline  text,
  add column if not exists school_accent   text,
  add column if not exists director_name   text,
  add column if not exists director_role   text;

-- 3. Les certificats déjà émis reçoivent leur école.
update public.certificates c
   set school_name    = s.name_fr,
       school_tagline = s.tagline_fr,
       school_accent  = s.accent,
       director_name  = s.director_name,
       director_role  = coalesce(nullif(s.director_role, ''), 'Directeur')
  from public.courses co
  join public.schools s on s.id = co.school_id
 where co.id = c.course_id
   and c.school_name is null;

-- 4. Émission : l'école est enregistrée avec le certificat.
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
    school_name, school_tagline, school_accent, director_name, director_role
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
    v_school.director_name,
    coalesce(nullif(v_school.director_role, ''), 'Directeur')
  )
  returning * into v_cert;

  perform public.log_audit('certificate.issued', 'certificates', v_cert.id::text,
                           jsonb_build_object('serial', v_serial, 'course_id', p_course_id));

  return v_cert;
end;
$$;


