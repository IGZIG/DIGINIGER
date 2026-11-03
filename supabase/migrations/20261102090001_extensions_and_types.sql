-- ============================================================================
-- DIGINIGER — 0001 — Extensions, types et utilitaires
-- Académie numérique intelligente : socle de base de données
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'instructor', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'course_status') then
    create type public.course_status as enum ('draft', 'in_review', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'course_level') then
    create type public.course_level as enum ('debutant', 'intermediaire', 'avance');
  end if;
  if not exists (select 1 from pg_type where typname = 'enrollment_status') then
    create type public.enrollment_status as enum ('active', 'completed', 'cancelled', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'lesson_status') then
    create type public.lesson_status as enum ('not_started', 'in_progress', 'completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'exercise_type') then
    create type public.exercise_type as enum ('quiz', 'open', 'project');
  end if;
  if not exists (select 1 from pg_type where typname = 'attempt_status') then
    create type public.attempt_status as enum ('in_progress', 'submitted', 'graded', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'billing_interval') then
    create type public.billing_interval as enum ('month', 'year', 'one_time');
  end if;
  if not exists (select 1 from pg_type where typname = 'plan_audience') then
    create type public.plan_audience as enum ('individual', 'business');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_provider') then
    create type public.payment_provider as enum ('mobile_money', 'card', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'transaction_status') then
    create type public.transaction_status as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'promo_kind') then
    create type public.promo_kind as enum ('percent', 'amount');
  end if;
  if not exists (select 1 from pg_type where typname = 'refund_status') then
    create type public.refund_status as enum ('requested', 'approved', 'refused', 'processed');
  end if;
  if not exists (select 1 from pg_type where typname = 'application_kind') then
    create type public.application_kind as enum ('instructor', 'enterprise', 'contact');
  end if;
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum ('new', 'reviewing', 'accepted', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'generation_status') then
    create type public.generation_status as enum ('queued', 'running', 'ready', 'failed', 'published', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type public.document_status as enum ('pending', 'indexed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'content_source') then
    create type public.content_source as enum ('manual', 'ai_generated');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger générique : met à jour la colonne updated_at avant chaque UPDATE.';
