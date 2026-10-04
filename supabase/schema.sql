-- Titiplen.id database. Apply only to a dedicated Titiplen Supabase project.
-- No user data or Supabase keys should be committed to Git.
create extension if not exists pgcrypto;
create sequence if not exists public.invoice_seq;
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  phone_e164 text not null unique check (phone_e164 ~ '^\+62[0-9]{8,13}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  event_date date,
  status text not null default 'Aktif' check (status in ('Aktif','Selesai')),
  created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  event_id uuid references public.events(id),
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  brand text not null default '',
  product_name text not null check (char_length(trim(product_name))>0),
  variant text not null default '',
  quantity int not null check(quantity>0),
  cost_unit bigint not null check(cost_unit>=0),
  fee_unit bigint not null check(fee_unit>=0),
  extra_fee_unit bigint not null check(extra_fee_unit>=0),
  shipping_charge bigint not null default 0 check(shipping_charge>=0),
  shipping_cost bigint not null default 0 check(shipping_cost>=0),
  discount bigint not null default 0 check(discount>=0),
  check (discount <= quantity*(cost_unit+fee_unit+extra_fee_unit)+shipping_charge)
);
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default (
    'TPL-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.invoice_seq')::text,6,'0')
  ),
  customer_id uuid not null references public.customers(id),
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id)
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  amount bigint not null check(amount>0),
  paid_at timestamptz not null default now(),
  reference text,
  method text not null default 'QRIS' check (method in ('QRIS','Transfer','Tunai')),
  created_at timestamptz not null default now()
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
  category text not null check(char_length(trim(category))>0),
  description text not null default '',
  amount bigint not null check(amount>0),
  spent_at date not null default current_date,
  created_at timestamptz not null default now()
);
create table if not exists public.settings (
  id int primary key default 1 check(id=1),
  whatsapp_number text not null default '',
  qris_image_url text not null default '',
  business_name text not null default 'Titiplen.id',
  updated_at timestamptz not null default now()
);
insert into public.settings(id,whatsapp_number,qris_image_url,business_name)
  values(1,'','','Titiplen.id') on conflict (id) do nothing;
create index if not exists orders_customer_idx on public.orders(customer_id);
create index if not exists orders_event_idx on public.orders(event_id);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists invoices_customer_idx on public.invoices(customer_id);
create index if not exists payments_invoice_idx on public.payments(invoice_id);
create index if not exists expenses_event_idx on public.expenses(event_id);

-- Admin authorization is a server-managed table, never derived from editable user metadata.
create or replace function public.is_titiplen_admin()
returns boolean language sql stable security definer
set search_path=public,pg_temp
as $$ select exists (
  select 1 from public.admin_users where user_id=(select auth.uid())
) $$;
revoke all on function public.is_titiplen_admin() from public;
grant execute on function public.is_titiplen_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.customers enable row level security;
alter table public.events enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.settings enable row level security;

create policy "Admin may read own role" on public.admin_users
 for select to authenticated using (user_id=(select auth.uid()));
-- Admin may manage data (but cannot grant themselves admin status).
create policy "Admin customers" on public.customers for all to authenticated
 using (public.is_titiplen_admin()) with check (public.is_titiplen_admin());
create policy "Admin events" on public.events for all to authenticated
 using (public.is_titiplen_admin()) with check (public.is_titiplen_admin());
create policy "Admin orders" on public.orders for all to authenticated
 using (public.is_titiplen_admin()) with check (public.is_titiplen_admin());
create policy "Admin order items" on public.order_items for all to authenticated
 using (public.is_titiplen_admin()) with check (public.is_titiplen_admin());
create policy "Admin invoices" on public.invoices for all to authenticated
 using (public.is_titiplen_admin()) with check (public.is_titiplen_admin());
create policy "Admin invoice items" on public.invoice_items for all to authenticated
 using (public.is_titiplen_admin()) with check (public.is_titiplen_admin());
create policy "Admin payments" on public.payments for all to authenticated
 using (public.is_titiplen_admin()) with check (public.is_titiplen_admin());
create policy "Admin expenses" on public.expenses for all to authenticated
 using (public.is_titiplen_admin()) with check (public.is_titiplen_admin());
create policy "Admin settings" on public.settings for all to authenticated
 using (public.is_titiplen_admin()) with check (public.is_titiplen_admin());

-- Customer detail access requires an AUTHENTICATED phone in Supabase JWT
-- populated after SMS OTP verification. A number typed into an input is never an authorization credential.
create policy "Customers read own profile" on public.customers
 for select to authenticated
 using ((select auth.uid()) is not null and phone_e164=coalesce(auth.jwt()->>'phone',''));
create policy "Customers read own orders" on public.orders
 for select to authenticated
 using (exists(select 1 from public.customers c where c.id=customer_id and c.phone_e164=coalesce(auth.jwt()->>'phone','')));
create policy "Customers read own items" on public.order_items
 for select to authenticated
 using (exists(select 1 from public.orders o join public.customers c on c.id=o.customer_id
 where o.id=order_id and c.phone_e164=coalesce(auth.jwt()->>'phone','')));
create policy "Customers read own invoices" on public.invoices
 for select to authenticated
 using (exists(select 1 from public.customers c where c.id=customer_id and c.phone_e164=coalesce(auth.jwt()->>'phone','')));
create policy "Customers read own invoice items" on public.invoice_items
 for select to authenticated
 using (exists(select 1 from public.invoices i join public.customers c on c.id=i.customer_id
 where i.id=invoice_id and c.phone_e164=coalesce(auth.jwt()->>'phone','')));
create policy "Customers read own payments" on public.payments
 for select to authenticated
 using (exists(select 1 from public.invoices i join public.customers c on c.id=i.customer_id
 where i.id=invoice_id and c.phone_e164=coalesce(auth.jwt()->>'phone','')));
create policy "Verified users read payment instructions" on public.settings
 for select to authenticated using ((select auth.uid()) is not null);

-- Prevent invoice reassignment (customer and event attribution remain linked to original orders).
create or replace function public.validate_invoice_item()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare linked_customer uuid; invoice_customer uuid;
begin
 select o.customer_id into linked_customer from public.order_items oi
 join public.orders o on o.id=oi.order_id where oi.id=new.order_item_id;
 select customer_id into invoice_customer from public.invoices where id=new.invoice_id;
 if linked_customer is null or invoice_customer is null or linked_customer<>invoice_customer
 then raise exception 'Barang dan invoice harus dimiliki customer yang sama'; end if;
 return new;
end $$;
drop trigger if exists ensure_invoice_customer on public.invoice_items;
create trigger ensure_invoice_customer before insert or update on public.invoice_items
 for each row execute function public.validate_invoice_item();

-- Atomic creation protects against partial orders.
create or replace function public.create_titiplen_order(
 p_customer uuid,p_event uuid,p_notes text,p_items jsonb
) returns uuid language plpgsql set search_path=public,pg_temp as $$
declare new_order uuid; item jsonb;
begin
 if not public.is_titiplen_admin() then raise exception 'Unauthorized'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Barang belum diisi'; end if;
 insert into public.orders(customer_id,event_id,notes) values(p_customer,p_event,p_notes) returning id into new_order;
 for item in select * from jsonb_array_elements(p_items) loop
  insert into public.order_items(order_id,brand,product_name,variant,quantity,cost_unit,fee_unit,extra_fee_unit,shipping_charge,shipping_cost,discount)
  values(new_order,coalesce(item->>'brand',''),item->>'product_name',coalesce(item->>'variant',''),
  (item->>'quantity')::int,(item->>'cost_unit')::bigint,(item->>'fee_unit')::bigint,
  (item->>'extra_fee_unit')::bigint,(item->>'shipping_charge')::bigint,
  (item->>'shipping_cost')::bigint,(item->>'discount')::bigint);
 end loop;
 return new_order;
end $$;

-- Atomic invoice generation; a product may appear in only one invoice.
create or replace function public.create_titiplen_invoice(
 p_customer uuid,p_item_ids uuid[],p_due_date date,p_notes text
) returns uuid language plpgsql set search_path=public,pg_temp as $$
declare new_invoice uuid; count_valid int; item_count int;
begin
 if not public.is_titiplen_admin() then raise exception 'Unauthorized'; end if;
 item_count:=coalesce(array_length(p_item_ids,1),0);
 if item_count<1 then raise exception 'Pilih minimal satu barang'; end if;
 select count(distinct oi.id) into count_valid
 from public.order_items oi join public.orders o on o.id=oi.order_id
 left join public.invoice_items ii on ii.order_item_id=oi.id
 where oi.id=any(p_item_ids) and o.customer_id=p_customer and ii.id is null;
 if count_valid<>item_count then raise exception 'Barang tidak sesuai, duplikat, atau sudah ditagihkan'; end if;
 insert into public.invoices(customer_id,due_date,notes)
 values(p_customer,p_due_date,p_notes) returning id into new_invoice;
 insert into public.invoice_items(invoice_id,order_item_id)
 select new_invoice, unnest(p_item_ids);
 return new_invoice;
end $$;

-- Admin confirms QRIS only after checking bank / merchant statement.
-- Race-safe on concurrent payments for the same invoice.
create or replace function public.record_titiplen_payment(
 p_invoice uuid,p_amount bigint,p_reference text
) returns uuid language plpgsql set search_path=public,pg_temp as $$
declare total_due bigint; already_paid bigint; new_id uuid;
begin
 if not public.is_titiplen_admin() then raise exception 'Unauthorized'; end if;
 if p_amount<=0 then raise exception 'Nominal tidak valid'; end if;
 perform 1 from public.invoices where id=p_invoice for update;
 if not found then raise exception 'Invoice tidak ditemukan'; end if;
 select coalesce(sum(oi.quantity*(oi.cost_unit+oi.fee_unit+oi.extra_fee_unit)
 +oi.shipping_charge-oi.discount),0) into total_due
 from public.invoice_items ii join public.order_items oi on oi.id=ii.order_item_id
 where ii.invoice_id=p_invoice;
 select coalesce(sum(amount),0) into already_paid from public.payments where invoice_id=p_invoice;
 if total_due-already_paid<p_amount then raise exception 'Pembayaran melebihi sisa tagihan'; end if;
 insert into public.payments(invoice_id,amount,reference,method)
 values(p_invoice,p_amount,p_reference,'QRIS') returning id into new_id;
 return new_id;
end $$;
revoke all on function public.create_titiplen_order(uuid,uuid,text,jsonb) from public;
revoke all on function public.create_titiplen_invoice(uuid,uuid[],date,text) from public;
revoke all on function public.record_titiplen_payment(uuid,bigint,text) from public;
grant execute on function public.create_titiplen_order(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.create_titiplen_invoice(uuid,uuid[],date,text) to authenticated;
grant execute on function public.record_titiplen_payment(uuid,bigint,text) to authenticated;

-- Bootstrap admin ONLY from Supabase SQL editor after creating an Auth email/password user:
-- insert into public.admin_users(user_id)
-- select id from auth.users where email='EMAIL-ADMIN-ANDA' on conflict do nothing;
