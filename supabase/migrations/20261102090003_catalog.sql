-- ============================================================================
-- DIGINIGER — 0003 — Catalogue : écoles, formations, contenu pédagogique
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Écoles
-- ---------------------------------------------------------------------------
create table if not exists public.schools (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_fr     text not null,
  name_en     text not null,
  tagline_fr  text not null default '',
  tagline_en  text not null default '',
  description_fr text not null default '',
  description_en text not null default '',
  icon        text not null default 'sparkles',
  accent      text not null default '#2563EB',
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Formations
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  school_id      uuid references public.schools (id) on delete set null,
  instructor_id  uuid references public.profiles (id) on delete set null,
  title_fr       text not null,
  title_en       text,
  subtitle_fr    text not null default '',
  subtitle_en    text,
  description_fr text not null default '',
  description_en text,
  level          public.course_level not null default 'debutant',
  status         public.course_status not null default 'draft',
  source         public.content_source not null default 'manual',
  language       text not null default 'fr' check (language in ('fr', 'en')),
  duration_hours numeric(6, 1) not null default 0,
  price_xof      integer not null default 0 check (price_xof >= 0),
  is_free        boolean not null default false,
  is_featured    boolean not null default false,
  cover_gradient text not null default 'from-night-800 to-electric-600',
  cover_url      text,
  outcomes       text[] not null default '{}',
  prerequisites  text[] not null default '{}',
  audience       text[] not null default '{}',
  rating_avg     numeric(3, 2) not null default 0 check (rating_avg between 0 and 5),
  rating_count   integer not null default 0,
  enrollment_count integer not null default 0,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Un cours publié doit être rattaché à une école
  constraint published_requires_school
    check (status <> 'published' or school_id is not null)
);

create index if not exists courses_status_idx on public.courses (status);
create index if not exists courses_school_idx on public.courses (school_id);
create index if not exists courses_instructor_idx on public.courses (instructor_id);
create index if not exists courses_search_idx on public.courses
  using gin ((coalesce(title_fr, '') || ' ' || coalesce(subtitle_fr, '') || ' ' || coalesce(description_fr, '')) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Modules et leçons
-- ---------------------------------------------------------------------------
create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title_fr    text not null,
  title_en    text,
  summary     text not null default '',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, position)
);

create table if not exists public.lessons (
  id            uuid primary key default gen_random_uuid(),
  module_id     uuid not null references public.modules (id) on delete cascade,
  title_fr      text not null,
  title_en      text,
  kind          text not null default 'video' check (kind in ('video', 'reading', 'exercise', 'project', 'live')),
  content_md    text not null default '',
  video_url     text,
  duration_min  integer not null default 0 check (duration_min >= 0),
  position      integer not null default 0,
  is_preview    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (module_id, position)
);

create index if not exists lessons_module_idx on public.lessons (module_id);

-- ---------------------------------------------------------------------------
-- Documents pédagogiques validés (source du RAG)
-- ---------------------------------------------------------------------------
create table if not exists public.course_documents (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  title        text not null,
  storage_path text,
  mime_type    text,
  size_bytes   bigint,
  status       public.document_status not null default 'pending',
  chunk_count  integer not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.course_documents (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  position    integer not null default 0,
  content     text not null,
  token_count integer not null default 0,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);

create index if not exists document_chunks_course_idx on public.document_chunks (course_id);
create index if not exists document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Le contexte du tuteur ne doit jamais être lisible directement côté client.
revoke all on table public.document_chunks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['schools', 'courses', 'modules', 'lessons', 'course_documents']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;
