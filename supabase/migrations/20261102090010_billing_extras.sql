-- ============================================================================
-- DIGINIGER — 0010 — Compléments de facturation
-- ============================================================================

-- Incrément atomique du compteur d'utilisation d'un code promo.
create or replace function public.increment_promo_redemption(p_promo_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.promo_codes
     set times_redeemed = times_redeemed + 1
   where id = p_promo_id
     and times_redeemed < max_redemptions;
$$;

revoke all on function public.increment_promo_redemption(uuid) from public;
grant execute on function public.increment_promo_redemption(uuid) to service_role;

-- Remboursement : marque la transaction et retire l'accès associé.
create or replace function public.process_refund(
  p_refund_id uuid,
  p_admin_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.refunds;
  v_tx public.transactions;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if v_refund.id is null then
    raise exception 'REFUND_NOT_FOUND';
  end if;

  select * into v_tx from public.transactions where id = v_refund.transaction_id;

  if not p_approve then
    update public.refunds
       set status = 'refused', processed_by = p_admin_id, processed_at = now()
     where id = p_refund_id;
    return;
  end if;

  update public.refunds
     set status = 'processed', processed_by = p_admin_id, processed_at = now()
   where id = p_refund_id;

  update public.transactions
     set status = 'refunded', metadata = metadata || jsonb_build_object('refund_note', p_note)
   where id = v_refund.transaction_id;

  if v_tx.course_id is not null then
    update public.enrollments
       set status = 'cancelled'
     where user_id = v_refund.user_id and course_id = v_tx.course_id;
  end if;

  perform public.log_audit('refund.processed', 'refunds', p_refund_id::text,
                           jsonb_build_object('amount', v_refund.amount_xof, 'note', p_note));
end;
$$;

revoke all on function public.process_refund(uuid, uuid, boolean, text) from public;
grant execute on function public.process_refund(uuid, uuid, boolean, text) to service_role;
