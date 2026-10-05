-- Historical JASTIP 2026 staging import.
-- Preserves legacy row totals exactly; DOES NOT affect live finance/order dashboards.
create table if not exists public.legacy_item_imports (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_file_hash text not null,
  source_sheet text not null,
  source_row integer not null check(source_row > 1),
  legacy_customer_name text not null,
  brand text not null default '',
  product_name text not null default '',
  variant text not null default '',
  quantity integer,
  cost_total bigint,
  fee_total bigint,
  extra_fee_total bigint,
  shipping_total bigint,
  discount_total bigint,
  sale_total bigint,
  legacy_profit bigint,
  legacy_payment_status text not null default '',
  source_note text not null default '',
  event_name text not null default '',
  payment_flag text not null default '',
  customer_id uuid references public.customers(id),
  matched_at timestamptz,
  matched_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check(quantity is null or quantity > 0),
  check(cost_total is null or cost_total >= 0),
  check(fee_total is null or fee_total >= 0),
  check(extra_fee_total is null or extra_fee_total >= 0),
  check(shipping_total is null or shipping_total >= 0),
  check(discount_total is null or discount_total >= 0),
  check(sale_total is null or sale_total >= 0)
);
create index if not exists legacy_item_imports_customer_idx on public.legacy_item_imports(customer_id);
create index if not exists legacy_item_imports_legacy_name_idx on public.legacy_item_imports(lower(legacy_customer_name));
create index if not exists legacy_item_imports_event_idx on public.legacy_item_imports(event_name);
alter table public.legacy_item_imports enable row level security;

drop policy if exists "Admin legacy item imports" on public.legacy_item_imports;
create policy "Admin legacy item imports" on public.legacy_item_imports
for all to authenticated
using (public.is_titiplen_admin())
with check (public.is_titiplen_admin());

create or replace function public.match_titiplen_legacy_group(
  p_legacy_name text,
  p_customer uuid
) returns integer
language plpgsql security invoker
set search_path=''
as $$
declare affected integer;
begin
  if not public.is_titiplen_admin() then
    raise exception 'Khusus admin Titiplen' using errcode='42501';
  end if;
  if char_length(trim(coalesce(p_legacy_name,'')))=0 then
    raise exception 'Nama lama wajib dipilih';
  end if;
  if not exists(select 1 from public.customers c where c.id=p_customer) then
    raise exception 'Member tujuan tidak ditemukan';
  end if;
  update public.legacy_item_imports
  set customer_id=p_customer, matched_at=now(), matched_by=(select auth.uid())
  where legacy_customer_name=p_legacy_name;
  get diagnostics affected=row_count;
  return affected;
end $$;
revoke all on function public.match_titiplen_legacy_group(text,uuid) from public,anon;
grant execute on function public.match_titiplen_legacy_group(text,uuid) to authenticated;

create or replace function public.match_titiplen_legacy_item(
  p_item uuid,
  p_customer uuid
) returns uuid
language plpgsql security invoker
set search_path=''
as $$
begin
  if not public.is_titiplen_admin() then
    raise exception 'Khusus admin Titiplen' using errcode='42501';
  end if;
  if not exists(select 1 from public.customers c where c.id=p_customer) then
    raise exception 'Member tujuan tidak ditemukan';
  end if;
  update public.legacy_item_imports
  set customer_id=p_customer, matched_at=now(), matched_by=(select auth.uid())
  where id=p_item;
  if not found then raise exception 'Baris rekap tidak ditemukan'; end if;
  return p_item;
end $$;
revoke all on function public.match_titiplen_legacy_item(uuid,uuid) from public,anon;
grant execute on function public.match_titiplen_legacy_item(uuid,uuid) to authenticated;
