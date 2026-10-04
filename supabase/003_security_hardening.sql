-- Titiplen security hardening, run ONLY on project pukkwituooodcbtdruki.
-- Customer-facing line totals are deliberately separate from private purchase costs.

-- Default Supabase privileges may grant EXECUTE directly to anon.
-- Explicitly revoke those grants rather than relying on REVOKE ... FROM PUBLIC alone.
revoke all on function public.create_titiplen_order(uuid,uuid,text,jsonb) from public, anon;
revoke all on function public.create_titiplen_invoice(uuid,uuid[],date,text) from public, anon;
revoke all on function public.record_titiplen_payment(uuid,bigint,text) from public, anon;
revoke all on function public.is_titiplen_admin() from public, anon;
revoke all on function public.validate_invoice_item() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.create_titiplen_order(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.create_titiplen_invoice(uuid,uuid[],date,text) to authenticated;
grant execute on function public.record_titiplen_payment(uuid,bigint,text) to authenticated;
grant execute on function public.is_titiplen_admin() to authenticated;

-- The admins table already allows the authenticated user to read only their own role.
-- This function does NOT need SECURITY DEFINER to validate role membership.
create or replace function public.is_titiplen_admin()
returns boolean language sql stable security invoker
set search_path = ''
as $$
select exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()))
$$;

-- Revoke all direct customer reads: users must never be able to inspect
-- cost_unit, fee_unit, shipping_cost, private notes or payment references via REST.
drop policy if exists "Customers read own profile" on public.customers;
drop policy if exists "Customers read own orders" on public.orders;
drop policy if exists "Customers read own items" on public.order_items;
drop policy if exists "Customers read own invoices" on public.invoices;
drop policy if exists "Customers read own invoice items" on public.invoice_items;
drop policy if exists "Customers read own payments" on public.payments;
drop policy if exists "Customers see events from own orders" on public.events;
drop policy if exists "Verified users read payment instructions" on public.settings;

-- Security-definer is needed to produce a strict projection of customer-facing
-- fields without granting direct read access to private-cost tables.
-- No phone input is accepted; the verified number comes exclusively from Supabase Auth.
create or replace function public.get_titiplen_customer_portal()
returns jsonb language plpgsql stable security definer
set search_path = ''
as $$
declare
  verified_user_id uuid;
  verified_phone text;
  customer_key uuid;
begin
  verified_user_id := (select auth.uid());
  verified_phone := (select auth.jwt()->>'phone');
  if verified_user_id is null or verified_phone is null then
    raise exception 'Verifikasi nomor HP diperlukan' using errcode='28000';
  end if;

  -- A JWT phone field alone is not enough. Require a confirmed Supabase Auth phone.
  if not exists (
    select 1 from auth.users u
    where u.id=verified_user_id
      and u.phone=verified_phone
      and u.phone_confirmed_at is not null
  ) then
    raise exception 'Nomor HP belum diverifikasi' using errcode='28000';
  end if;

  select c.id into customer_key
  from public.customers c where c.phone_e164=verified_phone;
  if customer_key is null then
    raise exception 'Nomor belum terdaftar sebagai customer Titiplen' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'customers', (
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'name',c.name,'phone_e164',c.phone_e164
      )) from public.customers c where c.id=customer_key
    ),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',o.id,'customer_id',o.customer_id,'event_id',o.event_id,
        'created_at',o.created_at,'notes',null
      )) from public.orders o
      where o.customer_id=customer_key
    ),'[]'::jsonb),
    'order_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',oi.id,
        'order_id',oi.order_id,
        'brand',oi.brand,
        'product_name',oi.product_name,
        'variant',oi.variant,
        'quantity',oi.quantity,
        'sale_total',oi.quantity*(oi.cost_unit+oi.fee_unit+oi.extra_fee_unit)
                       +oi.shipping_charge-oi.discount
      ))
      from public.order_items oi
      join public.orders o on o.id=oi.order_id
      where o.customer_id=customer_key
    ),'[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'name',e.name,'event_date',e.event_date,'status',e.status
      ))
      from public.events e
      where exists (
        select 1 from public.orders o
        where o.event_id=e.id and o.customer_id=customer_key
      )
    ),'[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'customer_id',i.customer_id,
        'invoice_number',i.invoice_number,'due_date',i.due_date,
        'created_at',i.created_at,'notes',null
      )) from public.invoices i
      where i.customer_id=customer_key
    ),'[]'::jsonb),
    'invoice_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ii.id,'invoice_id',ii.invoice_id,'order_item_id',ii.order_item_id
      ))
      from public.invoice_items ii
      join public.invoices i on i.id=ii.invoice_id
      where i.customer_id=customer_key
    ),'[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'invoice_id',p.invoice_id,
        'amount',p.amount,'paid_at',p.paid_at,
        'method',p.method,'reference',null
      ))
      from public.payments p
      join public.invoices i on i.id=p.invoice_id
      where i.customer_id=customer_key
    ),'[]'::jsonb),
    'expenses','[]'::jsonb,
    'settings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'whatsapp_number',s.whatsapp_number,
        'qris_image_url',s.qris_image_url,'business_name',s.business_name
      )) from public.settings s where s.id=1
    ),'[]'::jsonb)
  );
end $$;
revoke all on function public.get_titiplen_customer_portal() from public, anon;
grant execute on function public.get_titiplen_customer_portal() to authenticated;

create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);
-- Protect invoice arithmetic: prevent changing the underlying priced line once billed.
create or replace function public.prevent_billed_item_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if exists(select 1 from public.invoice_items ii where ii.order_item_id=old.id) then
    raise exception 'Barang yang sudah ditagihkan tidak boleh diubah/hapus; gunakan alur pembatalan invoice' using errcode='23514';
  end if;
  return old;
end $$;
revoke all on function public.prevent_billed_item_mutation() from public, anon, authenticated;
drop trigger if exists protect_billed_items on public.order_items;
create trigger protect_billed_items before update or delete on public.order_items
for each row execute function public.prevent_billed_item_mutation();

-- Invoice/customer immutable after issuance; prevent order reassignment that could
-- change event attribution or customer ownership after billing.
create or replace function public.prevent_invoiced_order_reassignment()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if (old.customer_id is distinct from new.customer_id or old.event_id is distinct from new.event_id)
    and exists (
      select 1 from public.order_items oi
      join public.invoice_items ii on ii.order_item_id=oi.id
      where oi.order_id=old.id
    ) then
    raise exception 'Pesanan dengan barang tertagih tidak boleh dipindahkan ke customer/event lain' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.prevent_invoiced_order_reassignment() from public, anon, authenticated;
drop trigger if exists protect_invoiced_orders on public.orders;
create trigger protect_invoiced_orders before update on public.orders
for each row execute function public.prevent_invoiced_order_reassignment();

create or replace function public.prevent_invoice_customer_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if old.customer_id is distinct from new.customer_id then
    raise exception 'Customer invoice tidak boleh diubah' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.prevent_invoice_customer_mutation() from public, anon, authenticated;
drop trigger if exists protect_invoice_owner on public.invoices;
create trigger protect_invoice_owner before update on public.invoices
for each row execute function public.prevent_invoice_customer_mutation();
