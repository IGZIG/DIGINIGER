-- ===========================================================================
-- Documents de formation — import par les formateurs
-- ===========================================================================
-- Objectif
-- --------
-- Permettre à un formateur d'importer les supports de SA formation (PDF,
-- Word, PowerPoint, tableur, texte, image), de les publier aux apprenants
-- inscrits, et de tracer qui télécharge quoi.
--
-- Le dépôt de fichiers se fait dans un compartiment Supabase Storage PRIVÉ
-- (`course-files`). Aucun lien public n'est généré : la lecture passe par une
-- URL signée de courte durée, délivrée uniquement après contrôle de l'accès
-- (formateur propriétaire, administrateur, ou apprenant inscrit).
--
-- Les tables `course_documents` / `document_chunks` existaient déjà mais
-- servaient à la base de connaissances du tuteur IA (documents générés par
-- le serveur, sans fichier). On ne les modifie pas : on crée une table
-- distincte pour les fichiers réellement importés, afin de ne pas mélanger
-- deux usages et de ne rien casser dans l'indexation IA.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Compartiment de stockage privé
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-files',
  'course-files',
  false,
  26214400, -- 25 Mo
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Table des documents de formation
-- ---------------------------------------------------------------------------
create table if not exists public.course_files (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  title         text not null,
  description   text,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text not null,
  size_bytes    bigint not null default 0,
  -- visible : l'apprenant inscrit peut le télécharger
  -- hidden  : réservé au formateur et à l'administration
  visibility    text not null default 'visible',
  download_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint course_files_visibility_check check (visibility in ('hidden', 'visible')),
  constraint course_files_title_len check (char_length(title) between 3 and 160),
  constraint course_files_size_check check (size_bytes >= 0 and size_bytes <= 26214400)
);

create index if not exists idx_course_files_course on public.course_files (course_id, created_at desc);
create index if not exists idx_course_files_uploader on public.course_files (uploaded_by);

drop trigger if exists course_files_set_updated_at on public.course_files;
create trigger course_files_set_updated_at
  before update on public.course_files
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Journal des téléchargements (traçabilité)
-- ---------------------------------------------------------------------------
create table if not exists public.course_file_downloads (
  id           uuid primary key default gen_random_uuid(),
  file_id      uuid not null references public.course_files (id) on delete cascade,
  profile_id   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_course_file_downloads_file
  on public.course_file_downloads (file_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. RLS — qui voit quoi
-- ---------------------------------------------------------------------------
alter table public.course_files enable row level security;
alter table public.course_file_downloads enable row level security;

-- Lecture :
--   - formateur propriétaire du cours et administrateur : tout ;
--   - apprenant inscrit : uniquement les documents visibles.
drop policy if exists course_files_read on public.course_files;
create policy course_files_read on public.course_files
  for select to authenticated
  using (
    public.is_admin()
    or public.is_instructor_of(course_id)
    or (
      visibility = 'visible'
      and exists (
        select 1 from public.enrollments e
        where e.course_id = course_files.course_id
          and e.user_id = auth.uid()
          and e.status in ('active', 'completed')
      )
    )
  );

-- Écriture : formateur propriétaire du cours, ou administrateur.
-- L'apprenant n'a AUCUN droit d'écriture : ni insertion, ni modification.
drop policy if exists course_files_insert on public.course_files;
create policy course_files_insert on public.course_files
  for insert to authenticated
  with check (public.is_admin() or public.is_instructor_of(course_id));

drop policy if exists course_files_update on public.course_files;
create policy course_files_update on public.course_files
  for update to authenticated
  using (public.is_admin() or public.is_instructor_of(course_id))
  with check (public.is_admin() or public.is_instructor_of(course_id));

drop policy if exists course_files_delete on public.course_files;
create policy course_files_delete on public.course_files
  for delete to authenticated
  using (public.is_admin() or public.is_instructor_of(course_id));

-- Journal des téléchargements : le formateur du cours et l'admin lisent ;
-- l'apprenant ne voit que ses propres téléchargements. Insertion par le
-- serveur uniquement (service_role), donc aucune politique d'écriture.
drop policy if exists course_file_downloads_read on public.course_file_downloads;
create policy course_file_downloads_read on public.course_file_downloads
  for select to authenticated
  using (
    public.is_admin()
    or profile_id = auth.uid()
    or exists (
      select 1
        from public.course_files f
       where f.id = course_file_downloads.file_id
         and public.is_instructor_of(f.course_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 5. RLS du compartiment `course-files`
-- ---------------------------------------------------------------------------
-- Convention de chemin : <course_id>/<uuid>-<nom-fichier-assaini>
-- Le premier dossier du chemin est l'identifiant du cours : la RLS s'appuie
-- dessus pour savoir qui peut déposer ou lire un fichier.

drop policy if exists course_files_bucket_insert on storage.objects;
create policy course_files_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-files'
    and (public.is_admin() or public.is_instructor_of(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists course_files_bucket_update on storage.objects;
create policy course_files_bucket_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'course-files'
    and (public.is_admin() or public.is_instructor_of(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists course_files_bucket_delete on storage.objects;
create policy course_files_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-files'
    and (public.is_admin() or public.is_instructor_of(((storage.foldername(name))[1])::uuid))
  );

-- Lecture directe : la voie normale est l'URL signée générée côté serveur
-- (qui contourne la RLS le temps de la validité du lien). On autorise tout de
-- même la lecture au formateur du cours et à l'admin pour leurs propres
-- vérifications. Les apprenants passent exclusivement par l'URL signée.
drop policy if exists course_files_bucket_read on storage.objects;
create policy course_files_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'course-files'
    and (public.is_admin() or public.is_instructor_of(((storage.foldername(name))[1])::uuid))
  );

comment on table public.course_files is
  'Supports importés par les formateurs (PDF, Word, PPT, tableur, texte, image). Lecture via URL signée uniquement.';
comment on table public.course_file_downloads is
  'Journal des téléchargements de supports : qui a téléchargé quoi et quand.';
