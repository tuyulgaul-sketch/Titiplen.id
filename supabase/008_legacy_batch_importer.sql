-- One-time safe importer for compact historical JASTIP arrays.
-- Function is revoked from API roles; it is only used by database owner/admin migration tooling.
create or replace function public.import_titiplen_legacy_batch(
  p_payload_base64 text,
  p_file_hash text
) returns integer
language plpgsql
security invoker
set search_path=''
as $$
declare inserted_count integer;
begin
  with raw as (
    select value as r
    from jsonb_array_elements(
      convert_from(decode(p_payload_base64,'base64'),'UTF8')::jsonb
    )
  ), ins as (
    insert into public.legacy_item_imports(
      source_key,source_file_hash,source_sheet,source_row,
      legacy_customer_name,brand,product_name,variant,quantity,
      cost_total,fee_total,extra_fee_total,shipping_total,discount_total,
      sale_total,legacy_profit,legacy_payment_status,source_note,event_name,payment_flag
    )
    select
      p_file_hash||':JASTIP 2026:'||(r->>0),
      p_file_hash,
      'JASTIP 2026',
      (r->>0)::integer,
      coalesce(r->>1,''),
      coalesce(r->>2,''),
      coalesce(r->>3,''),
      coalesce(r->>4,''),
      nullif(r->>5,'')::integer,
      nullif(r->>6,'')::bigint,
      nullif(r->>7,'')::bigint,
      nullif(r->>8,'')::bigint,
      nullif(r->>9,'')::bigint,
      nullif(r->>10,'')::bigint,
      nullif(r->>11,'')::bigint,
      nullif(r->>12,'')::bigint,
      coalesce(r->>13,''),
      coalesce(r->>14,''),
      coalesce(r->>15,''),
      coalesce(r->>16,'')
    from raw
    on conflict(source_key) do nothing
    returning 1
  )
  select count(*) into inserted_count from ins;
  return inserted_count;
end $$;

revoke all on function public.import_titiplen_legacy_batch(text,text) from public,anon,authenticated;
