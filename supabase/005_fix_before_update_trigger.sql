-- Fix trigger return value: BEFORE UPDATE must return NEW (not OLD)
-- for non-invoiced items; DELETE must return OLD.
-- Keeps prior protection for invoice-backed item prices and status.
create or replace function public.prevent_billed_item_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if exists(select 1 from public.invoice_items ii where ii.order_item_id=old.id) then
    raise exception 'Barang yang sudah ditagihkan tidak boleh diubah/hapus; gunakan alur pembatalan invoice' using errcode='23514';
  end if;
  if tg_op='UPDATE' then
    return new;
  end if;
  return old;
end $$;
revoke all on function public.prevent_billed_item_mutation() from public, anon, authenticated;
