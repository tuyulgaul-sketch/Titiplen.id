-- Read only events referenced by orders belonging to the OTP-verified phone.
create policy "Customers see events from own orders" on public.events
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    join public.customers c on c.id=o.customer_id
    where o.event_id=events.id
      and c.phone_e164=coalesce(auth.jwt()->>'phone','')
      and (select auth.uid()) is not null
  )
);
