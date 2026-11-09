-- Group all no-login submissions by customer WhatsApp + event into one invoice.
-- Shipping requests are append-only and unverified until admin approves them.
create sequence if not exists public.jastip_event_invoice_seq;
create table if not exists public.jastip_open_event_invoices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  phone_e164 text not null check (phone_e164 ~ '^\+62[0-9]{8,13}$'),
  invoice_number text not null unique default (
    'TLP-E-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.jastip_event_invoice_seq')::text,6,'0')
  ),
  created_at timestamptz not null default now(),
  unique(event_id,phone_e164)
);
create index if not exists jastip_event_invoices_phone on public.jastip_open_event_invoices(phone_e164);

create or replace function public.ensure_jastip_event_invoice()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  insert into public.jastip_open_event_invoices(event_id,phone_e164)
  values(new.event_id,new.phone_e164)
  on conflict(event_id,phone_e164) do nothing;
  return new;
end $$;
revoke all on function public.ensure_jastip_event_invoice() from public,anon,authenticated;
drop trigger if exists ensure_jastip_event_invoice_on_submit on public.jastip_open_orders;
create trigger ensure_jastip_event_invoice_on_submit
after insert on public.jastip_open_orders for each row
execute function public.ensure_jastip_event_invoice();

-- Preserve old submissions and group them into event invoices.
insert into public.jastip_open_event_invoices(event_id,phone_e164,created_at)
select event_id,phone_e164,min(created_at)
from public.jastip_open_orders group by event_id,phone_e164
on conflict(event_id,phone_e164) do nothing;

alter table public.events add column if not exists shopee_checkout_url text;
alter table public.events drop constraint if exists events_shopee_url_is_shopee;
alter table public.events add constraint events_shopee_url_is_shopee
 check (shopee_checkout_url is null or
   shopee_checkout_url ~* '^https://([a-z0-9-]+\.)*shopee\.co\.id([/:?#]|$)');

create table if not exists public.jastip_open_delivery_requests (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.jastip_open_event_invoices(id) on delete cascade,
  method text not null check (method in ('shopee','manual')),
  recipient_name text,
  recipient_phone text,
  recipient_address text,
  notes text not null default '' check(char_length(notes)<=500),
  status text not null default 'pending_review'
    check(status in ('pending_review','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint manual_address_required check(
    (method='shopee' and recipient_name is null and recipient_phone is null and recipient_address is null) or
    (method='manual' and char_length(trim(coalesce(recipient_name,''))) between 2 and 120
       and recipient_phone ~ '^\+62[0-9]{8,13}$'
       and char_length(trim(coalesce(recipient_address,''))) between 15 and 1000)
  )
);
create index if not exists jastip_delivery_invoice_created
 on public.jastip_open_delivery_requests(invoice_id,created_at desc);
create index if not exists jastip_delivery_pending
 on public.jastip_open_delivery_requests(status,created_at desc);

create table if not exists public.jastip_public_action_limits (
  scope text not null check(scope in ('lookup','delivery')),
  ip_fingerprint text not null,
  hour_bucket timestamptz not null,
  hits int not null default 1,
  primary key(scope,ip_fingerprint,hour_bucket)
);

create or replace function public.take_jastip_public_action(
 p_scope text,p_ip_fingerprint text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare new_hits int;
begin
 if p_scope not in ('lookup','delivery') or p_ip_fingerprint !~ '^[0-9a-f]{64}$'
 then return false; end if;
 insert into public.jastip_public_action_limits(scope,ip_fingerprint,hour_bucket,hits)
 values(p_scope,p_ip_fingerprint,date_trunc('hour',now()),1)
 on conflict(scope,ip_fingerprint,hour_bucket)
 do update set hits=public.jastip_public_action_limits.hits+1
 where public.jastip_public_action_limits.hits <
       case when p_scope='lookup' then 20 else 10 end
 returning hits into new_hits;
 return new_hits is not null;
end $$;
revoke all on function public.take_jastip_public_action(text,text) from public,anon,authenticated;
grant execute on function public.take_jastip_public_action(text,text) to service_role;

alter table public.jastip_open_event_invoices enable row level security;
alter table public.jastip_open_delivery_requests enable row level security;
alter table public.jastip_public_action_limits enable row level security;

drop policy if exists "Admin reads event invoices" on public.jastip_open_event_invoices;
create policy "Admin reads event invoices" on public.jastip_open_event_invoices
for all to authenticated using(public.is_titiplen_admin())
with check(public.is_titiplen_admin());

drop policy if exists "Admin manages delivery requests" on public.jastip_open_delivery_requests;
create policy "Admin manages delivery requests" on public.jastip_open_delivery_requests
for all to authenticated using(public.is_titiplen_admin())
with check(public.is_titiplen_admin());

revoke all on public.jastip_open_event_invoices from anon;
revoke all on public.jastip_open_delivery_requests from anon;
revoke all on public.jastip_public_action_limits from anon,authenticated;
grant select,insert,update,delete on public.jastip_open_event_invoices to authenticated;
grant select,insert,update,delete on public.jastip_open_delivery_requests to authenticated;

do $block$ begin
 if not exists (select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='jastip_open_delivery_requests')
 then alter publication supabase_realtime add table public.jastip_open_delivery_requests; end if;
end $block$;
