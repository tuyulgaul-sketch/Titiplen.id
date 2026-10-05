-- Titiplen member directory / bulk WAG import.
-- Must only be deployed to Titiplen Supabase project pukkwituooodcbtdruki.
alter table public.customers add column if not exists is_wag_member boolean not null default false;
alter table public.customers add column if not exists wag_saved_name text;
alter table public.customers add column if not exists wag_last_imported_at timestamptz;
alter table public.customers add column if not exists name_changed_at timestamptz;
create index if not exists customers_wag_member_idx on public.customers(is_wag_member) where is_wag_member=true;
comment on column public.customers.wag_saved_name is 'Source Excel saved-name label. Not overwritten on rename; may be a phone number. Customer portal must not expose this field.';
comment on column public.customers.is_wag_member is 'Admin-imported member from the Titiplen WhatsApp group.';

create or replace function public.upsert_titiplen_wag_members(
  p_members jsonb,
  p_update_names boolean default false
) returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare
  item jsonb;
  raw_phone text;
  normalized_phone text;
  display_name text;
  saved_label text;
  new_rows integer := 0;
  renamed_rows integer := 0;
  existing_rows integer := 0;
  c_id uuid;
  previous_name text;
  batch_size integer;
  seen_phones text[] := '{}'::text[];
begin
  if not public.is_titiplen_admin() then
    raise exception 'Khusus admin Titiplen' using errcode='42501';
  end if;
  if p_members is null or jsonb_typeof(p_members) <> 'array' then
    raise exception 'Format harus array data member' using errcode='22023';
  end if;
  batch_size:=jsonb_array_length(p_members);
  if batch_size < 1 or batch_size > 500 then
    raise exception 'Upload per batch harus antara 1 sampai 500 member' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_members) loop
    if jsonb_typeof(item)<>'object' then
      raise exception 'Baris member harus objek' using errcode='22023';
    end if;
    raw_phone:=trim(coalesce(item->>'phone',''));
    normalized_phone:=regexp_replace(raw_phone,'[^0-9]','','g');
    if left(normalized_phone,1)='0' then
      normalized_phone:='62'||substring(normalized_phone from 2);
    end if;
    if normalized_phone !~ '^62[0-9]{8,13}$' then
      raise exception 'Nomor HP invalid pada baris %',new_rows+renamed_rows+existing_rows+1 using errcode='22023';
    end if;
    normalized_phone:='+'||normalized_phone;
    if normalized_phone=any(seen_phones) then
      raise exception 'Nomor HP duplikat pada file: %', normalized_phone using errcode='23505';
    end if;
    seen_phones:=array_append(seen_phones,normalized_phone);

    display_name:=trim(coalesce(item->>'name',''));
    saved_label:=trim(coalesce(item->>'saved_name',''));
    if char_length(display_name)<2 or char_length(display_name)>120 then
      raise exception 'Nama harus 2–120 karakter pada baris %',new_rows+renamed_rows+existing_rows+1 using errcode='22023';
    end if;
    if char_length(saved_label)>120 then
      raise exception 'Nama sumber terlalu panjang pada baris %',new_rows+renamed_rows+existing_rows+1 using errcode='22023';
    end if;
    select c.id,c.name into c_id,previous_name
      from public.customers c where c.phone_e164=normalized_phone;
    if c_id is null then
      insert into public.customers(name,phone_e164,is_wag_member,wag_saved_name,wag_last_imported_at)
      values(display_name,normalized_phone,true,nullif(saved_label,''),now());
      new_rows:=new_rows+1;
    else
      -- The original name is only overwritten when admin expressly chooses update.
      update public.customers set
        is_wag_member=true,
        wag_saved_name=coalesce(nullif(saved_label,''),wag_saved_name),
        wag_last_imported_at=now(),
        name=case when p_update_names then display_name else name end,
        name_changed_at=case when p_update_names and name is distinct from display_name then now() else name_changed_at end
      where id=c_id;
      if p_update_names and previous_name is distinct from display_name then
        renamed_rows:=renamed_rows+1;
      else
        existing_rows:=existing_rows+1;
      end if;
    end if;
    c_id:=null;
    previous_name:=null;
  end loop;
  return jsonb_build_object(
    'added',new_rows,
    'renamed',renamed_rows,
    'unchanged',existing_rows,
    'processed',batch_size
  );
end $$;
revoke all on function public.upsert_titiplen_wag_members(jsonb,boolean) from public,anon;
grant execute on function public.upsert_titiplen_wag_members(jsonb,boolean) to authenticated;
