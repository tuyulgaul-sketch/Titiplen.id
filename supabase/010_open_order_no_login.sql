-- Open-order event module for Titiplen.id. Additive to legacy system.
-- Customers submit without accounts; only admins may read private order rows.
alter table public.events add column if not exists open_order_enabled boolean not null default false;
alter table public.events add column if not exists open_order_slug text unique;
alter table public.events drop constraint if exists events_open_order_slug_format;
alter table public.events add constraint events_open_order_slug_format
  check (open_order_slug is null or open_order_slug ~ '^[a-z0-9][a-z0-9-]{5,99}$');

create sequence if not exists public.jastip_open_invoice_seq;

create table if not exists public.jastip_open_orders (
 id uuid primary key default gen_random_uuid(),
 client_key uuid not null unique,
 event_id uuid not null references public.events(id) on delete restrict,
 customer_name text not null check (char_length(trim(customer_name)) between 2 and 120),
 phone_e164 text not null check (phone_e164 ~ '^\+62[0-9]{8,13}$'),
 invoice_number text not null unique default (
   'TLP-O-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.jastip_open_invoice_seq')::text,6,'0')
 ),
 access_token uuid not null unique default gen_random_uuid(),
 request_ip_hash text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.jastip_open_order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.jastip_open_orders(id) on delete cascade,
 product_name text not null check (char_length(trim(product_name)) between 2 and 160),
 variant text not null default '' check (char_length(variant)<=160),
 notes text not null default '' check (char_length(notes)<=500),
 quantity int not null check (quantity between 1 and 20),
 image_path text not null check (char_length(image_path) between 10 and 400),
 status text not null default 'pending' check (status in ('pending','found','not_found')),
 final_unit_price bigint not null default 0 check (final_unit_price>=0),
 admin_note text not null default '' check (char_length(admin_note)<=500),
 updated_at timestamptz not null default now(),
 constraint jastip_open_price_by_status check (
   (status='found' and final_unit_price > 0) or
   (status in ('pending','not_found') and final_unit_price=0)
 )
);
create index if not exists jastip_open_orders_event_created_idx
 on public.jastip_open_orders(event_id,created_at desc);
create index if not exists jastip_open_orders_phone_idx
 on public.jastip_open_orders(phone_e164);
create index if not exists jastip_open_items_order_idx
 on public.jastip_open_order_items(order_id);

create table if not exists public.jastip_open_rate_limits (
 ip_fingerprint text not null,
 hour_bucket timestamptz not null,
 hits int not null default 1,
 primary key(ip_fingerprint,hour_bucket)
);

alter table public.jastip_open_orders enable row level security;
alter table public.jastip_open_order_items enable row level security;
alter table public.jastip_open_rate_limits enable row level security;

drop policy if exists "Titiplen admin open orders" on public.jastip_open_orders;
create policy "Titiplen admin open orders" on public.jastip_open_orders
 for all to authenticated
 using (public.is_titiplen_admin())
 with check (public.is_titiplen_admin());
drop policy if exists "Titiplen admin open items" on public.jastip_open_order_items;
create policy "Titiplen admin open items" on public.jastip_open_order_items
 for all to authenticated
 using (public.is_titiplen_admin())
 with check (public.is_titiplen_admin());

drop policy if exists "Visitors see open order events" on public.events;
create policy "Visitors see open order events" on public.events
 for select to anon using (open_order_enabled=true and status='Aktif' and open_order_slug is not null);
grant select on public.events to anon;
revoke all on public.jastip_open_orders from anon;
revoke all on public.jastip_open_order_items from anon;
revoke all on public.jastip_open_rate_limits from anon, authenticated;
grant select,insert,update,delete on public.jastip_open_orders to authenticated;
grant select,insert,update,delete on public.jastip_open_order_items to authenticated;

-- Atomic public submission. Callable only from authenticated server-side Edge Function
-- running as service_role. No RLS bypass function is exposed to anonymous browsers.
create or replace function public.submit_jastip_open_order(
 p_client_key uuid,
 p_event_slug text,
 p_customer_name text,
 p_phone_e164 text,
 p_items jsonb,
 p_ip_fingerprint text
)
returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 v_event uuid;
 v_id uuid;
 v_token uuid;
 v_number text;
 v_item jsonb;
 v_i integer;
 v_count integer;
 v_hits integer;
 v_hour timestamptz;
begin
 select id,access_token,invoice_number into v_id,v_token,v_number
   from public.jastip_open_orders where client_key=p_client_key;
 if found then
   return jsonb_build_object('order_id',v_id,'token',v_token,'invoice_number',v_number);
 end if;
 if p_client_key is null or p_ip_fingerprint is null or length(p_ip_fingerprint)<>64 then
   raise exception 'Permintaan tidak valid' using errcode='22023';
 end if;
 select e.id into v_event from public.events e
  where e.open_order_slug=p_event_slug and e.open_order_enabled=true and e.status='Aktif';
 if v_event is null then raise exception 'Event tidak menerima pesanan' using errcode='22023'; end if;
 if char_length(trim(coalesce(p_customer_name,''))) not between 2 and 120
    or coalesce(p_phone_e164,'') !~ '^\+62[0-9]{8,13}$' then
   raise exception 'Nama atau nomor WhatsApp tidak valid' using errcode='22023';
 end if;
 if jsonb_typeof(p_items) is distinct from 'array' then
   raise exception 'Daftar barang tidak valid' using errcode='22023';
 end if;
 v_count:=jsonb_array_length(p_items);
 if v_count<1 or v_count>8 then
   raise exception 'Masukkan antara 1 hingga 8 barang' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_item) is distinct from 'object'
      or char_length(trim(coalesce(v_item->>'product_name',''))) not between 2 and 160
      or char_length(coalesce(v_item->>'variant',''))>160
      or char_length(coalesce(v_item->>'notes',''))>500
      or coalesce(v_item->>'quantity','') !~ '^([1-9]|1[0-9]|20)$'
      or coalesce(v_item->>'image_path','') !~ ('^'||p_client_key::text||'/[0-7]\.(jpg|png|webp)$')
   then raise exception 'Ada detail barang yang tidak valid' using errcode='22023'; end if;
 end loop;
 v_hour:=date_trunc('hour',now());
 insert into public.jastip_open_rate_limits(ip_fingerprint,hour_bucket,hits)
 values(p_ip_fingerprint,v_hour,1)
 on conflict(ip_fingerprint,hour_bucket) do update set hits=public.jastip_open_rate_limits.hits+1
 where public.jastip_open_rate_limits.hits<15
 returning hits into v_hits;
 if v_hits is null then raise exception 'Terlalu banyak pesanan. Coba lagi nanti.' using errcode='22023'; end if;
 insert into public.jastip_open_orders(client_key,event_id,customer_name,phone_e164,request_ip_hash)
 values(p_client_key,v_event,trim(p_customer_name),p_phone_e164,p_ip_fingerprint)
 returning id,access_token,invoice_number into v_id,v_token,v_number;
 for v_item in select value from jsonb_array_elements(p_items) loop
   insert into public.jastip_open_order_items
   (order_id,product_name,variant,notes,quantity,image_path)
   values(v_id,trim(v_item->>'product_name'),coalesce(v_item->>'variant',''),
          coalesce(v_item->>'notes',''),(v_item->>'quantity')::int,v_item->>'image_path');
 end loop;
 return jsonb_build_object('order_id',v_id,'token',v_token,'invoice_number',v_number);
end $$;
revoke all on function public.submit_jastip_open_order(uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_jastip_open_order(uuid,text,text,text,jsonb,text) to service_role;

-- Admin-controlled status updates send Postgres Changes to authorized admins.
do $block$
begin
 if not exists (select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='jastip_open_orders') then
    alter publication supabase_realtime add table public.jastip_open_orders;
 end if;
 if not exists (select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='jastip_open_order_items') then
    alter publication supabase_realtime add table public.jastip_open_order_items;
 end if;
end $block$;

-- Images are private: customer uploads only via server Edge Function.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('jastip-references','jastip-references',false,3145728,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
drop policy if exists "Titiplen admin reads jastip reference photos" on storage.objects;
create policy "Titiplen admin reads jastip reference photos"
 on storage.objects for select to authenticated
 using(bucket_id='jastip-references' and public.is_titiplen_admin());