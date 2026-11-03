-- ============================================================================
-- DIGINIGER — 0006 — Sécurité : RLS, permissions, audit
-- ============================================================================
-- Modèle :
--   * anon        : lecture des contenus publiés uniquement + vérification de certificat.
--   * authenticated : ses propres données ; contenus publiés ; écritures limitées.
--   * service_role : webhooks, tâches IA, génération de contenu (jamais exposé au client).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Journal d'audit
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          bigserial primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  public.user_role,
  action      text not null,
  entity      text not null,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create or replace function public.log_audit(
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_ip inet default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, metadata, ip, user_agent)
  values (auth.uid(), public.current_role(), p_action, p_entity, p_entity_id, coalesce(p_metadata, '{}'::jsonb), p_ip, p_user_agent);
end;
$$;

revoke all on function public.log_audit(text, text, text, jsonb, inet, text) from public;
grant execute on function public.log_audit(text, text, text, jsonb, inet, text) to authenticated, service_role;

revoke all on table public.audit_logs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Activation de RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'schools', 'courses', 'modules', 'lessons', 'course_documents',
    'document_chunks', 'enrollments', 'lesson_progress', 'exercises', 'attempts',
    'certificates', 'ai_conversations', 'ai_messages', 'ai_usage', 'course_generations',
    'plans', 'subscriptions', 'promo_codes', 'transactions', 'payment_events',
    'refunds', 'application_requests', 'audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_staff());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- schools : lecture publique, écriture admin
-- ---------------------------------------------------------------------------
drop policy if exists schools_public_read on public.schools;
create policy schools_public_read on public.schools
  for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists schools_admin_write on public.schools;
create policy schools_admin_write on public.schools
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
drop policy if exists courses_public_read on public.courses;
create policy courses_public_read on public.courses
  for select to anon, authenticated
  using (status = 'published' or public.is_admin() or instructor_id = auth.uid());

drop policy if exists courses_instructor_insert on public.courses;
create policy courses_instructor_insert on public.courses
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_staff() and instructor_id = auth.uid())
  );

drop policy if exists courses_owner_update on public.courses;
create policy courses_owner_update on public.courses
  for update to authenticated
  using (public.is_admin() or instructor_id = auth.uid())
  with check (public.is_admin() or instructor_id = auth.uid());

drop policy if exists courses_admin_delete on public.courses;
create policy courses_admin_delete on public.courses
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- modules & leçons : lecture si le cours est visible ; écriture staff du cours
-- ---------------------------------------------------------------------------
drop policy if exists modules_read on public.modules;
create policy modules_read on public.modules
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = modules.course_id
        and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists modules_write on public.modules;
create policy modules_write on public.modules
  for all to authenticated
  using (public.is_admin() or public.is_instructor_of(course_id))
  with check (public.is_admin() or public.is_instructor_of(course_id));

drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.modules m
        join public.courses c on c.id = m.course_id
      where m.id = lessons.module_id
        and (c.status = 'published' or c.instructor_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons
  for all to authenticated
  using (
    exists (select 1 from public.modules m
            where m.id = lessons.module_id
              and (public.is_admin() or public.is_instructor_of(m.course_id)))
  )
  with check (
    exists (select 1 from public.modules m
            where m.id = lessons.module_id
              and (public.is_admin() or public.is_instructor_of(m.course_id)))
  );

-- ---------------------------------------------------------------------------
-- Documents pédagogiques (RAG)
-- ---------------------------------------------------------------------------
drop policy if exists documents_read on public.course_documents;
create policy documents_read on public.course_documents
  for select to authenticated
  using (public.is_admin() or public.is_instructor_of(course_id));

drop policy if exists documents_write on public.course_documents;
create policy documents_write on public.course_documents
  for all to authenticated
  using (public.is_admin() or public.is_instructor_of(course_id))
  with check (public.is_admin() or public.is_instructor_of(course_id));

-- document_chunks : accès révoqué aux rôles client (voir 0003) → aucune politique.

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_instructor_of(course_id)
  );

drop policy if exists enrollments_self_insert on public.enrollments;
create policy enrollments_self_insert on public.enrollments
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists enrollments_admin_update on public.enrollments;
create policy enrollments_admin_update on public.enrollments
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor_of(course_id))
  with check (user_id = auth.uid() or public.is_admin() or public.is_instructor_of(course_id));

-- ---------------------------------------------------------------------------
-- lesson_progress
-- ---------------------------------------------------------------------------
drop policy if exists progress_select on public.lesson_progress;
create policy progress_select on public.lesson_progress
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor_of(course_id));

drop policy if exists progress_upsert on public.lesson_progress;
create policy progress_upsert on public.lesson_progress
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_course(course_id));

drop policy if exists progress_update on public.lesson_progress;
create policy progress_update on public.lesson_progress
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- exercises & attempts
-- ---------------------------------------------------------------------------
drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises
  for select to authenticated
  using (
    public.is_admin()
    or public.is_instructor_of(course_id)
    or (
      is_published
      and exists (
        select 1 from public.enrollments e
        where e.course_id = exercises.course_id
          and e.user_id = auth.uid()
          and e.status in ('active', 'completed')
      )
    )
  );

drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises
  for all to authenticated
  using (public.is_admin() or public.is_instructor_of(course_id))
  with check (public.is_admin() or public.is_instructor_of(course_id));

drop policy if exists attempts_select on public.attempts;
create policy attempts_select on public.attempts
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_instructor_of(course_id));

drop policy if exists attempts_insert on public.attempts;
create policy attempts_insert on public.attempts
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_course(course_id));

drop policy if exists attempts_update on public.attempts;
create policy attempts_update on public.attempts
  for update to authenticated
  using (
    (user_id = auth.uid() and status in ('in_progress', 'submitted'))
    or public.is_admin()
    or public.is_instructor_of(course_id)
  )
  with check (
    (user_id = auth.uid())
    or public.is_admin()
    or public.is_instructor_of(course_id)
  );

-- ---------------------------------------------------------------------------
-- certificates : lecture publique limitée via la vue de vérification
-- ---------------------------------------------------------------------------
drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists certificates_admin_write on public.certificates;
create policy certificates_admin_write on public.certificates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- IA
-- ---------------------------------------------------------------------------
drop policy if exists ai_conv_select on public.ai_conversations;
create policy ai_conv_select on public.ai_conversations
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists ai_conv_insert on public.ai_conversations;
create policy ai_conv_insert on public.ai_conversations
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists ai_conv_update on public.ai_conversations;
create policy ai_conv_update on public.ai_conversations
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_conv_delete on public.ai_conversations;
create policy ai_conv_delete on public.ai_conversations
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists ai_msg_select on public.ai_messages;
create policy ai_msg_select on public.ai_messages
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.ai_conversations c
               where c.id = ai_messages.conversation_id and c.user_id = auth.uid())
  );

-- Les messages sont écrits exclusivement par la route serveur (service_role),
-- qui applique la validation, le quota et la journalisation.
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Générations de cours : admins et formateurs seulement
-- ---------------------------------------------------------------------------
drop policy if exists generations_read on public.course_generations;
create policy generations_read on public.course_generations
  for select to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Facturation
-- ---------------------------------------------------------------------------
drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans
  for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists plans_admin_write on public.plans;
create policy plans_admin_write on public.plans
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_update_self on public.subscriptions;
create policy subscriptions_update_self on public.subscriptions
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists promo_read on public.promo_codes;
create policy promo_read on public.promo_codes
  for select to authenticated
  using (public.is_admin());

drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists refunds_select on public.refunds;
create policy refunds_select on public.refunds
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists refunds_insert_self on public.refunds;
create policy refunds_insert_self on public.refunds
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists refunds_admin_update on public.refunds;
create policy refunds_admin_update on public.refunds
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- payment_events : jamais accessible aux clients (service_role only)

-- ---------------------------------------------------------------------------
-- Demandes (contact, formateurs, entreprises)
-- ---------------------------------------------------------------------------
drop policy if exists applications_insert_any on public.application_requests;
create policy applications_insert_any on public.application_requests
  for insert to anon, authenticated
  with check (true);

drop policy if exists applications_select on public.application_requests;
create policy applications_select on public.application_requests
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists applications_admin_update on public.application_requests;
create policy applications_admin_update on public.application_requests
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Vue publique de vérification des certificats
-- Expose uniquement des champs non sensibles, avec sécurité invoker + filtre.
-- ---------------------------------------------------------------------------
create or replace view public.certificate_verification
with (security_invoker = true) as
select
  c.serial,
  c.student_name,
  c.course_title,
  c.score,
  c.issued_at,
  c.revoked_at,
  (c.revoked_at is null) as is_valid
from public.certificates c
where c.revoked_at is null;

grant select on public.certificate_verification to anon, authenticated;

drop policy if exists certificates_public_verify on public.certificates;
create policy certificates_public_verify on public.certificates
  for select to anon
  using (revoked_at is null);
