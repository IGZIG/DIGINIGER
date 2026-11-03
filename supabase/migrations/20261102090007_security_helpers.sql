-- ============================================================================
-- DIGINIGER — 0007 — Sécurité applicative : quotas IA, rate limiting, vues
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Consommation du tuteur IA (atomique et bornée)
-- Renvoie true si le message est autorisé, false si le quota est atteint.
-- ---------------------------------------------------------------------------
create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_limit integer,
  p_tokens integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_limit <= 0 then
    return false;
  end if;

  insert into public.ai_usage (user_id, day, messages, tokens)
  values (p_user_id, current_date, 1, greatest(p_tokens, 0))
  on conflict (user_id, day) do update
    set messages = public.ai_usage.messages + 1,
        tokens   = public.ai_usage.tokens + greatest(p_tokens, 0)
    where public.ai_usage.messages < p_limit
  returning messages into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, integer, integer) from public;
grant execute on function public.consume_ai_quota(uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Rate limiting générique (par clé : ip, user, action)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key          text not null,
  bucket_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, bucket_start)
);

revoke all on table public.rate_limits from anon, authenticated;
alter table public.rate_limits enable row level security;

create or replace function public.take_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket timestamptz;
  v_hits integer;
begin
  -- Fenêtre fixe alignée sur l'horodatage
  v_bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (key, bucket_start, hits)
  values (p_key, v_bucket, 1)
  on conflict (key, bucket_start) do update
    set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  -- Nettoyage opportuniste des fenêtres anciennes
  delete from public.rate_limits
   where bucket_start < now() - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.take_rate_limit(text, integer, integer) from public;
grant execute on function public.take_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Catalogue public (une seule requête pour la page d'accueil et le catalogue)
-- ---------------------------------------------------------------------------
create or replace view public.public_courses
with (security_invoker = true) as
select
  c.id, c.slug, c.title_fr, c.title_en, c.subtitle_fr, c.subtitle_en,
  c.level, c.language, c.duration_hours, c.price_xof, c.is_free, c.is_featured,
  c.cover_gradient, c.rating_avg, c.rating_count, c.enrollment_count,
  c.outcomes, c.prerequisites, c.audience, c.published_at,
  s.slug  as school_slug,
  s.name_fr as school_name_fr,
  s.name_en as school_name_en,
  s.accent as school_accent,
  pr.full_name as instructor_name,
  pr.avatar_url as instructor_avatar,
  (select count(*) from public.modules m where m.course_id = c.id) as module_count,
  (select count(*) from public.lessons l
     join public.modules m on m.id = l.module_id
    where m.course_id = c.id) as lesson_count
from public.courses c
left join public.schools s on s.id = c.school_id
left join public.profiles pr on pr.id = c.instructor_id
where c.status = 'published';

grant select on public.public_courses to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Indicateurs administrateur (service_role uniquement)
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'instructors', (select count(*) from public.profiles where role = 'instructor'),
    'courses_published', (select count(*) from public.courses where status = 'published'),
    'courses_draft', (select count(*) from public.courses where status in ('draft', 'in_review')),
    'enrollments', (select count(*) from public.enrollments),
    'completions', (select count(*) from public.enrollments where status = 'completed'),
    'certificates', (select count(*) from public.certificates where revoked_at is null),
    'revenue_xof', (select coalesce(sum(total_xof), 0) from public.transactions where status = 'paid'),
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active'),
    'ai_messages_today', (select coalesce(sum(messages), 0) from public.ai_usage where day = current_date),
    'pending_applications', (select count(*) from public.application_requests where status = 'new'),
    'revenue_by_month', (
      select coalesce(jsonb_agg(row_to_json(r) order by r.month), '[]'::jsonb)
      from (
        select to_char(date_trunc('month', t.paid_at), 'YYYY-MM') as month,
               sum(t.total_xof)::bigint as revenue
        from public.transactions t
        where t.status = 'paid' and t.paid_at > now() - interval '12 months'
        group by 1
      ) r
    ),
    'enrollments_by_school', (
      select coalesce(jsonb_agg(row_to_json(r) order by r.total desc), '[]'::jsonb)
      from (
        select s.name_fr as school, count(e.id)::bigint as total
        from public.schools s
        left join public.courses c on c.school_id = s.id
        left join public.enrollments e on e.course_id = c.id
        group by s.name_fr
      ) r
    )
  );
$$;

revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to service_role;

-- ---------------------------------------------------------------------------
-- Assistant de progression étudiant (service_role / route serveur)
-- ---------------------------------------------------------------------------
create or replace function public.student_progress_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'courses_enrolled', (select count(*) from public.enrollments where user_id = p_user_id),
    'courses_completed', (select count(*) from public.enrollments
                           where user_id = p_user_id and status = 'completed'),
    'lessons_completed', (select count(*) from public.lesson_progress
                           where user_id = p_user_id and status = 'completed'),
    'minutes_learned', (select coalesce(sum(seconds_spent), 0) / 60 from public.lesson_progress
                         where user_id = p_user_id),
    'average_score', (
      select coalesce(round(avg(score)), 0) from public.attempts
      where user_id = p_user_id and score is not null
    ),
    'certificates', (select count(*) from public.certificates
                      where user_id = p_user_id and revoked_at is null)
  );
$$;

revoke all on function public.student_progress_summary(uuid) from public;
grant execute on function public.student_progress_summary(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Réservé au service_role : événements de paiement et secrets
-- ---------------------------------------------------------------------------
revoke all on table public.payment_events from anon, authenticated;
revoke all on table public.rate_limits from anon, authenticated;
