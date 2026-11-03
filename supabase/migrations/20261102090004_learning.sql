-- ============================================================================
-- DIGINIGER — 0004 — Apprentissage : inscriptions, progression, évaluations
-- ============================================================================

create table if not exists public.enrollments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  course_id     uuid not null references public.courses (id) on delete cascade,
  status        public.enrollment_status not null default 'active',
  progress_pct  integer not null default 0 check (progress_pct between 0 and 100),
  source        text not null default 'free' check (source in ('free', 'purchase', 'subscription', 'grant', 'business')),
  enrolled_at   timestamptz not null default now(),
  completed_at  timestamptz,
  last_activity_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists enrollments_user_idx on public.enrollments (user_id);
create index if not exists enrollments_course_idx on public.enrollments (course_id);

-- ---------------------------------------------------------------------------
-- Helpers d'autorisation dépendant des inscriptions
-- (déclarés après public.enrollments : dépendance SQL)
-- ---------------------------------------------------------------------------
create or replace function public.is_instructor_of(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.instructor_id = auth.uid()
  );
$$;

create or replace function public.can_access_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_admin()
    or public.is_instructor_of(p_course_id)
    or exists (
      select 1 from public.enrollments e
      where e.course_id = p_course_id
        and e.user_id = auth.uid()
        and e.status in ('active', 'completed')
    );
$$;

revoke all on function public.current_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_instructor_of(uuid) from public;
revoke all on function public.can_access_course(uuid) from public;
grant execute on function public.current_role() to authenticated, anon;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_staff() to authenticated, anon;
grant execute on function public.is_instructor_of(uuid) to authenticated, anon;
grant execute on function public.can_access_course(uuid) to authenticated, anon;

revoke all on function public.is_instructor_of(uuid) from public;
revoke all on function public.can_access_course(uuid) from public;
grant execute on function public.is_instructor_of(uuid) to authenticated, anon;
grant execute on function public.can_access_course(uuid) to authenticated, anon;

create table if not exists public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  course_id     uuid not null references public.courses (id) on delete cascade,
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  status        public.lesson_status not null default 'in_progress',
  seconds_spent integer not null default 0,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index if not exists lesson_progress_user_course_idx on public.lesson_progress (user_id, course_id);

-- ---------------------------------------------------------------------------
-- Exercices et examens
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  lesson_id     uuid references public.lessons (id) on delete set null,
  kind          public.exercise_type not null default 'quiz',
  title_fr      text not null,
  instructions  text not null default '',
  questions     jsonb not null default '[]'::jsonb,
  max_score     integer not null default 100,
  pass_score    integer not null default 60,
  time_limit_min integer,
  is_exam       boolean not null default false,
  is_published  boolean not null default false,
  source        public.content_source not null default 'manual',
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint questions_is_array check (jsonb_typeof(questions) = 'array')
);

create index if not exists exercises_course_idx on public.exercises (course_id);

create table if not exists public.attempts (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null references public.exercises (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete cascade,
  status       public.attempt_status not null default 'in_progress',
  answers      jsonb not null default '{}'::jsonb,
  score        integer check (score is null or score between 0 and 100),
  feedback     text,
  grader       text check (grader in ('auto', 'ai', 'instructor')),
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at    timestamptz,
  expires_at   timestamptz
);

create index if not exists attempts_user_idx on public.attempts (user_id, course_id);

-- Une tentative appartient toujours à l'apprenant authentifié : imposé en base.
create or replace function public.force_attempt_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Tentative attribuée à un autre utilisateur' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists attempts_force_owner on public.attempts;
create trigger attempts_force_owner
  before insert or update on public.attempts
  for each row execute function public.force_attempt_owner();

-- ---------------------------------------------------------------------------
-- Certificats
-- ---------------------------------------------------------------------------
create table if not exists public.certificates (
  id              uuid primary key default gen_random_uuid(),
  serial          text not null unique,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  student_name    text not null,
  course_title    text not null,
  score           integer,
  verification_hash text not null,
  issued_at       timestamptz not null default now(),
  revoked_at      timestamptz,
  revoke_reason   text,
  pdf_path        text,
  unique (user_id, course_id)
);

create index if not exists certificates_serial_idx on public.certificates (serial);

-- ---------------------------------------------------------------------------
-- Tuteur IA : conversations, messages, quotas
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid references public.courses (id) on delete set null,
  title      text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  citations       jsonb not null default '[]'::jsonb,
  tokens_in       integer,
  tokens_out      integer,
  model           text,
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null default current_date,
  messages   integer not null default 0,
  tokens     integer not null default 0,
  unique (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Générateur de formations (brouillons IA modifiables avant publication)
-- ---------------------------------------------------------------------------
create table if not exists public.course_generations (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references public.profiles (id) on delete cascade,
  school_id    uuid references public.schools (id) on delete set null,
  course_id    uuid references public.courses (id) on delete set null,
  prompt       jsonb not null,
  result       jsonb,
  status       public.generation_status not null default 'queued',
  error        text,
  model        text,
  tokens       integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Déclencheurs d'apprentissage
-- ---------------------------------------------------------------------------
drop trigger if exists lesson_progress_set_updated_at on public.lesson_progress;
create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

drop trigger if exists course_generations_set_updated_at on public.course_generations;
create trigger course_generations_set_updated_at
  before update on public.course_generations
  for each row execute function public.set_updated_at();

-- Recalcul de la progression à chaque leçon terminée.
create or replace function public.recalc_course_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer;
  v_done  integer;
  v_pct   integer;
begin
  select count(*) into v_total from public.lessons l
    join public.modules m on m.id = l.module_id
   where m.course_id = new.course_id;

  select count(*) into v_done from public.lesson_progress lp
   where lp.course_id = new.course_id
     and lp.user_id = new.user_id
     and lp.status = 'completed';

  v_pct := case when v_total = 0 then 0 else floor((v_done::numeric / v_total) * 100) end;

  update public.enrollments
     set progress_pct = v_pct,
         last_activity_at = now(),
         status = case when v_pct >= 100 then 'completed'::public.enrollment_status else status end,
         completed_at = case when v_pct >= 100 then coalesce(completed_at, now()) else completed_at end
   where user_id = new.user_id and course_id = new.course_id;

  return new;
end;
$$;

drop trigger if exists lesson_progress_recalc on public.lesson_progress;
create trigger lesson_progress_recalc
  after insert or update of status on public.lesson_progress
  for each row execute function public.recalc_course_progress();

-- ---------------------------------------------------------------------------
-- Recherche sémantique (RAG)
-- ---------------------------------------------------------------------------
create or replace function public.match_course_chunks(
  p_course_id uuid,
  p_embedding vector(1536),
  p_match_count integer default 6,
  p_min_similarity double precision default 0.7
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> p_embedding) as similarity
  from public.document_chunks dc
  where dc.course_id = p_course_id
    and dc.embedding is not null
    and public.can_access_course(p_course_id)
    and 1 - (dc.embedding <=> p_embedding) >= p_min_similarity
  order by dc.embedding <=> p_embedding
  limit least(coalesce(p_match_count, 6), 20);
$$;

revoke all on function public.match_course_chunks(uuid, vector, integer, double precision) from public;
grant execute on function public.match_course_chunks(uuid, vector, integer, double precision) to service_role;
