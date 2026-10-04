-- On-event purchase journal for Titiplen. Apply ONLY to Supabase project pukkwituooodcbtdruki.
-- Existing orders remain considered purchased, but their historical purchase time is unknown.
alter table public.order_items
  add column if not exists purchase_status text not null default 'purchased'
    check (purchase_status in ('planned','purchased'));
alter table public.order_items
  add column if not exists purchased_at timestamptz;
alter table public.orders
  add column if not exists field_entry_key uuid;
create unique index if not exists orders_field_entry_key_uidx on public.orders(field_entry_key);
create index if not exists order_items_purchase_status_idx on public.order_items(purchase_status);

-- Atomic single-item write for shopping at events.
-- client_key remains stable across retries and prevents duplicate orders
-- if network drops after the server has committed a response.
create or replace function public.create_titiplen_field_entry(
  p_customer uuid,
  p_event uuid,
  p_notes text,
  p_item jsonb,
  p_purchase_status text,
  p_client_key uuid
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_order uuid;
  new_item uuid;
begin
  if not public.is_titiplen_admin() then
    raise exception 'Akses khusus admin' using errcode = '42501';
  end if;

  if p_client_key is null or p_event is null or p_customer is null then
    raise exception 'Customer, event, dan identitas entry wajib diisi';
  end if;
  if not exists (select 1 from public.events where id=p_event) then
    raise exception 'Event tidak ditemukan';
  end if;
  if not exists (select 1 from public.customers where id=p_customer) then
    raise exception 'Customer tidak ditemukan';
  end if;
  if p_purchase_status not in ('planned','purchased') or p_purchase_status is null then
    raise exception 'Status pembelian tidak valid';
  end if;
  if jsonb_typeof(p_item) is distinct from 'object' then
    raise exception 'Detail barang tidak valid';
  end if;
  if char_length(trim(coalesce(p_item->>'product_name',''))) = 0 then
    raise exception 'Nama barang wajib diisi';
  end if;

  insert into public.orders(customer_id,event_id,notes,field_entry_key)
  values(p_customer,p_event,coalesce(p_notes,''),p_client_key)
  on conflict (field_entry_key) do nothing
  returning id into new_order;

  if new_order is null then
    select id into new_order from public.orders where field_entry_key=p_client_key;
    if not found then raise exception 'Pengulangan entry belum dapat ditentukan; coba muat ulang'; end if;
    return new_order;
  end if;

  insert into public.order_items(
    order_id,brand,product_name,variant,quantity,
    cost_unit,fee_unit,extra_fee_unit,shipping_charge,shipping_cost,discount,
    purchase_status,purchased_at
  ) values (
    new_order,
    coalesce(p_item->>'brand',''),
    trim(p_item->>'product_name'),
    coalesce(p_item->>'variant',''),
    (p_item->>'quantity')::integer,
    (p_item->>'cost_unit')::bigint,
    (p_item->>'fee_unit')::bigint,
    (p_item->>'extra_fee_unit')::bigint,
    (p_item->>'shipping_charge')::bigint,
    (p_item->>'shipping_cost')::bigint,
    (p_item->>'discount')::bigint,
    p_purchase_status,
    case when p_purchase_status='purchased' then now() else null end
  ) returning id into new_item;

  return new_order;
end $$;

-- Explicit status transition; immutable invoiced goods cannot be edited.
create or replace function public.mark_titiplen_item_purchased(p_item_id uuid)
returns uuid language plpgsql security invoker
set search_path = ''
as $$
declare updated_id uuid;
begin
  if not public.is_titiplen_admin() then
    raise exception 'Akses khusus admin' using errcode = '42501';
  end if;
  update public.order_items
  set purchase_status='purchased',purchased_at=now()
  where id=p_item_id and purchase_status='planned'
  returning id into updated_id;
  if updated_id is null then
    raise exception 'Barang tidak ditemukan atau sudah dibeli';
  end if;
  return updated_id;
end $$;

revoke all on function public.create_titiplen_field_entry(uuid,uuid,text,jsonb,text,uuid) from public, anon;
revoke all on function public.mark_titiplen_item_purchased(uuid) from public, anon;
grant execute on function public.create_titiplen_field_entry(uuid,uuid,text,jsonb,text,uuid) to authenticated;
grant execute on function public.mark_titiplen_item_purchased(uuid) to authenticated;

-- Existing customer-facing RPC remains a strict projection; do not include
-- purchase cost, notes, status, or internal purchasing information.
