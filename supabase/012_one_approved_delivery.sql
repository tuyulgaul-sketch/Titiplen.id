-- Only one confirmed dispatch decision per event invoice.
create unique index if not exists jastip_one_approved_delivery_per_invoice
 on public.jastip_open_delivery_requests(invoice_id)
 where status='approved';

-- Reviewing a request is admin-only. The customer public endpoint never updates records;
-- it only appends pending_review requests for manual verification.
comment on table public.jastip_open_delivery_requests is
'Customer-provided shipping requests are unverified until approved by an admin after WhatsApp confirmation. Public lookup never returns shipping address.';