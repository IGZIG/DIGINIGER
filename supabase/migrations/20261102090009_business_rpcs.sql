-- ============================================================================
-- DIGINIGER — 0009 — Fonctions métier (RPC) appelées par l'application
-- ============================================================================
-- Toute la logique sensible vit ici, en SECURITY DEFINER, avec vérification
-- explicite de auth.uid(). Le client ne peut ni forger un score, ni choisir
-- son prix, ni s'octroyer un certificat.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Inscription à une formation
-- ---------------------------------------------------------------------------
create or replace function public.enroll_in_course(p_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_course public.courses;
  v_plan record;
  v_paid boolean;
  v_enrollment_id uuid;
  v_inserted boolean := false;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if v_course.id is null or v_course.status <> 'published' then
    raise exception 'COURSE_NOT_AVAILABLE' using errcode = 'P0002';
  end if;

  -- Accès déjà acquis ?
  select id into v_enrollment_id
    from public.enrollments
   where user_id = v_user and course_id = p_course_id;

  if v_enrollment_id is not null then
    return v_enrollment_id;
  end if;

  -- Contrôle des droits d'accès
  if not v_course.is_free and v_course.price_xof > 0 then
    select exists (
      select 1 from public.transactions t
       where t.user_id = v_user
         and t.course_id = p_course_id
         and t.status = 'paid'
    ) into v_paid;

    if not v_paid then
      select * into v_plan from public.my_active_plan();
      if v_plan.code is null or v_plan.course_access not in ('all', 'premium') then
        raise exception 'PAYMENT_REQUIRED' using errcode = 'P0003';
      end if;
    end if;
  end if;

  insert into public.enrollments (user_id, course_id, source)
  values (
    v_user,
    p_course_id,
    case
      when v_course.is_free or v_course.price_xof = 0 then 'free'
      when v_paid then 'purchase'
      else 'subscription'
    end
  )
  on conflict (user_id, course_id) do nothing
  returning id into v_enrollment_id;

  if v_enrollment_id is not null then
    v_inserted := true;
    update public.courses
       set enrollment_count = enrollment_count + 1
     where id = p_course_id;
  else
    select id into v_enrollment_id
      from public.enrollments
     where user_id = v_user and course_id = p_course_id;
  end if;

  if v_inserted then
    perform public.log_audit('enrollment.created', 'enrollments', v_enrollment_id::text,
                             jsonb_build_object('course_id', p_course_id));
  end if;

  return v_enrollment_id;
end;
$$;

revoke all on function public.enroll_in_course(uuid) from public;
grant execute on function public.enroll_in_course(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Marquer une leçon comme terminée
-- ---------------------------------------------------------------------------
create or replace function public.complete_lesson(p_lesson_id uuid, p_seconds integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_course_id uuid;
  v_progress integer;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select m.course_id into v_course_id
    from public.lessons l
    join public.modules m on m.id = l.module_id
   where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'LESSON_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.enrollments e
     where e.user_id = v_user and e.course_id = v_course_id
  ) then
    raise exception 'NOT_ENROLLED' using errcode = '42501';
  end if;

  insert into public.lesson_progress (user_id, course_id, lesson_id, status, seconds_spent, completed_at)
  values (v_user, v_course_id, p_lesson_id, 'completed', greatest(coalesce(p_seconds, 0), 0), now())
  on conflict (user_id, lesson_id) do update
    set status = 'completed',
        seconds_spent = public.lesson_progress.seconds_spent + greatest(coalesce(p_seconds, 0), 0),
        completed_at = coalesce(public.lesson_progress.completed_at, now());

  select progress_pct into v_progress
    from public.enrollments
   where user_id = v_user and course_id = v_course_id;

  return jsonb_build_object('progress_pct', v_progress);
end;
$$;

revoke all on function public.complete_lesson(uuid, integer) from public;
grant execute on function public.complete_lesson(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Démarrer une tentative d'exercice / examen
-- ---------------------------------------------------------------------------
create or replace function public.start_attempt(p_exercise_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_exercise public.exercises;
  v_attempt_id uuid;
  v_open integer;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_exercise from public.exercises where id = p_exercise_id;
  if v_exercise.id is null or not v_exercise.is_published then
    raise exception 'EXERCISE_NOT_AVAILABLE' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.enrollments e
     where e.user_id = v_user and e.course_id = v_exercise.course_id
       and e.status in ('active', 'completed')
  ) then
    raise exception 'NOT_ENROLLED' using errcode = '42501';
  end if;

  -- Réutilise une tentative en cours pour éviter le spam de lignes
  select id into v_attempt_id
    from public.attempts
   where user_id = v_user and exercise_id = p_exercise_id and status = 'in_progress'
   order by started_at desc
   limit 1;

  if v_attempt_id is not null then
    return v_attempt_id;
  end if;

  -- Au-delà de 5 tentatives sur un examen, on refuse (anti-abus)
  if v_exercise.is_exam then
    select count(*) into v_open
      from public.attempts
     where user_id = v_user and exercise_id = p_exercise_id;
    if v_open >= 5 then
      raise exception 'ATTEMPT_LIMIT_REACHED' using errcode = 'P0004';
    end if;
  end if;

  insert into public.attempts (exercise_id, user_id, course_id, status, expires_at)
  values (
    p_exercise_id, v_user, v_exercise.course_id, 'in_progress',
    case when v_exercise.time_limit_min is not null
         then now() + make_interval(mins => v_exercise.time_limit_min)
         else null end
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.start_attempt(uuid) from public;
grant execute on function public.start_attempt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Soumettre une tentative — correction côté serveur
-- ---------------------------------------------------------------------------
create or replace function public.submit_attempt(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.attempts;
  v_exercise public.exercises;
  v_total integer;
  v_correct integer := 0;
  v_score integer;
  v_passed boolean;
  v_question jsonb;
  v_index integer;
  v_answer jsonb;
  v_open_ended boolean;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_attempt from public.attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.user_id <> v_user then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_ALREADY_SUBMITTED' using errcode = 'P0005';
  end if;

  select * into v_exercise from public.exercises where id = v_attempt.exercise_id;
  v_open_ended := v_exercise.kind in ('open', 'project');
  v_total := jsonb_array_length(v_exercise.questions);

  -- Correction automatique des QCM
  if not v_open_ended and v_total > 0 then
    for v_index in 0 .. v_total - 1 loop
      v_question := v_exercise.questions -> v_index;
      v_answer := p_answers -> (v_question ->> 'id');
      if v_answer is not null
         and (v_answer #>> '{}')::text = (v_question ->> 'correct') then
        v_correct := v_correct + 1;
      end if;
    end loop;
    v_score := round((v_correct::numeric / v_total) * 100);
  end if;

  update public.attempts
     set answers = p_answers,
         submitted_at = now(),
         status = case when v_open_ended then 'submitted'::public.attempt_status
                       else 'graded'::public.attempt_status end,
         score = case when v_open_ended then null else v_score end,
         graded_at = case when v_open_ended then null else now() end,
         grader = case when v_open_ended then null else 'auto' end,
         feedback = case
           when v_open_ended then 'Votre travail a été envoyé pour évaluation.'
           when v_score >= v_exercise.pass_score
             then format('Réussi : %s %% (%s/%s réponses correctes).', v_score, v_correct, v_total)
           else format('Score de %s %% : le seuil de réussite est de %s %%.', v_score, v_exercise.pass_score)
         end
   where id = p_attempt_id;

  v_passed := (not v_open_ended) and v_score >= v_exercise.pass_score;

  perform public.log_audit('attempt.submitted', 'attempts', p_attempt_id::text,
                           jsonb_build_object('score', v_score, 'passed', v_passed));

  return jsonb_build_object(
    'score', v_score,
    'passed', v_passed,
    'correct', v_correct,
    'total', v_total,
    'pending_review', v_open_ended
  );
end;
$$;

revoke all on function public.submit_attempt(uuid, jsonb) from public;
grant execute on function public.submit_attempt(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Émission du certificat (vérifiée côté serveur)
-- ---------------------------------------------------------------------------
-- Conditions cumulatives :
--   * inscription terminée (progression 100 %) ou cours sans leçon ;
--   * tous les examens obligatoires réussis.
-- Le numéro de série est unique et non devinable ; le hash scelle le contenu.
-- ---------------------------------------------------------------------------
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
    encode(digest(v_serial || v_user::text || p_course_id::text, 'sha256'), 'hex')
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
-- 6. Tableau de bord apprenant (une seule requête)
-- ---------------------------------------------------------------------------
create or replace function public.student_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'summary', public.student_progress_summary(auth.uid()),
    'plan', (select to_jsonb(p) from public.my_active_plan() p),
    'ai_today', (
      select coalesce(messages, 0) from public.ai_usage
       where user_id = auth.uid() and day = current_date
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(row_to_json(r) order by r.at desc), '[]'::jsonb)
      from (
        select lp.updated_at as at, l.title_fr as lesson, c.title_fr as course, c.slug
          from public.lesson_progress lp
          join public.lessons l on l.id = lp.lesson_id
          join public.courses c on c.id = lp.course_id
         where lp.user_id = auth.uid()
         order by lp.updated_at desc
         limit 5
      ) r
    )
  );
$$;

revoke all on function public.student_dashboard() from public;
grant execute on function public.student_dashboard() to authenticated;

comment on function public.student_dashboard() is
  'Agrégat du tableau de bord apprenant. Ne renvoie que les données de auth.uid().';
