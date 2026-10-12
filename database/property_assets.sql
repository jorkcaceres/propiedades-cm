-- Property references and private PDF documents for properties and leases.
-- Apply through the authorized Supabase connector.

insert into public.pcm_permission_catalog(code,module,action) values
  ('property_references.view','property_references','view'),
  ('property_references.create','property_references','create'),
  ('property_references.edit','property_references','edit'),
  ('property_references.delete','property_references','delete'),
  ('property_documents.view','property_documents','view'),
  ('property_documents.upload','property_documents','upload'),
  ('property_documents.edit','property_documents','edit'),
  ('property_documents.delete','property_documents','delete'),
  ('lease_documents.view','lease_documents','view'),
  ('lease_documents.upload','lease_documents','upload'),
  ('lease_documents.edit','lease_documents','edit'),
  ('lease_documents.delete','lease_documents','delete')
on conflict(code) do update set module=excluded.module,action=excluded.action;

create table public.pcm_property_references (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.pcm_properties(id) on delete restrict,
  identifier_type text not null check(length(btrim(identifier_type)) between 2 and 80),
  identifier text not null check(length(btrim(identifier)) between 1 and 150),
  company text not null check(length(btrim(company)) between 2 and 150),
  service text not null check(length(btrim(service)) between 2 and 120),
  version integer not null default 1,
  created_by uuid not null references public.pcm_members(id) on delete restrict,
  updated_by uuid not null references public.pcm_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,company,service,identifier)
);
create index pcm_property_references_property_idx on public.pcm_property_references(property_id,created_at desc,id);
create index pcm_property_references_created_by_idx on public.pcm_property_references(created_by);
create index pcm_property_references_updated_by_idx on public.pcm_property_references(updated_by);

create table public.pcm_property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.pcm_properties(id) on delete restrict,
  name text not null check(length(btrim(name)) between 2 and 150),
  storage_path text not null unique check(storage_path ~ '^properties/[0-9a-f-]{36}/[0-9a-f-]{36}\\.pdf$'),
  original_name text not null check(length(original_name) between 1 and 255),
  mime_type text not null check(mime_type='application/pdf'),
  size_bytes bigint not null check(size_bytes between 1 and 20971520),
  version integer not null default 1,
  created_by uuid not null references public.pcm_members(id) on delete restrict,
  updated_by uuid not null references public.pcm_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pcm_property_documents_property_idx on public.pcm_property_documents(property_id,created_at desc,id);
create index pcm_property_documents_created_by_idx on public.pcm_property_documents(created_by);
create index pcm_property_documents_updated_by_idx on public.pcm_property_documents(updated_by);

create table public.pcm_lease_documents (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.pcm_leases(id) on delete restrict,
  name text not null check(length(btrim(name)) between 2 and 150),
  storage_path text not null unique check(storage_path ~ '^leases/[0-9a-f-]{36}/[0-9a-f-]{36}\\.pdf$'),
  original_name text not null check(length(original_name) between 1 and 255),
  mime_type text not null check(mime_type='application/pdf'),
  size_bytes bigint not null check(size_bytes between 1 and 20971520),
  version integer not null default 1,
  created_by uuid not null references public.pcm_members(id) on delete restrict,
  updated_by uuid not null references public.pcm_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pcm_lease_documents_lease_idx on public.pcm_lease_documents(lease_id,created_at desc,id);
create index pcm_lease_documents_created_by_idx on public.pcm_lease_documents(created_by);
create index pcm_lease_documents_updated_by_idx on public.pcm_lease_documents(updated_by);

create table public.pcm_storage_cleanup_queue (
  storage_path text primary key,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz
);
alter table public.pcm_storage_cleanup_queue enable row level security;
revoke all on public.pcm_storage_cleanup_queue from public,anon,authenticated;
create policy cleanup_queue_no_user_access on public.pcm_storage_cleanup_queue for all to authenticated using(false) with check(false);

create function pcm_private.guard_asset_record() returns trigger language plpgsql
security invoker set search_path='' as $$
declare module text:=tg_argv[0]; required_action text; server_operation boolean:=current_user in ('service_role','postgres');
begin
  required_action=case when tg_op='INSERT' then 'create' when tg_op='UPDATE' then 'edit' else 'delete' end;
  if module like '%documents' and required_action='create' then required_action='upload'; end if;
  if not server_operation and (not pcm_private.has_permission(module||'.view') or not pcm_private.has_permission(module||'.'||required_action)) then
    raise exception 'Operación no autorizada.' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  if tg_op='INSERT' then
    new.version=1;new.created_at=now();
    if not server_operation then new.created_by=auth.uid();new.updated_by=auth.uid();end if;
  else
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by then
      raise exception 'La identidad del registro es inmutable.' using errcode='23514';
    end if;
    if new.version<>old.version then raise exception 'La versión se genera en el servidor.' using errcode='23514';end if;
    new.version=old.version+1;
    if not server_operation then new.updated_by=auth.uid();end if;
  end if;
  if not exists(select 1 from public.pcm_members where id=new.created_by and active) or not exists(select 1 from public.pcm_members where id=new.updated_by and active) then raise exception 'El responsable no está autorizado.' using errcode='23514';end if;
  new.updated_at=now();return new;
end;$$;
revoke all on function pcm_private.guard_asset_record() from public,anon,authenticated;

create function pcm_private.audit_asset_record() returns trigger language plpgsql
security definer set search_path='' as $$
declare row_id uuid:=case when tg_op='DELETE' then old.id else new.id end;
begin
  insert into public.pcm_audit_events(actor_id,actor_kind,entity,entity_id,action,before_data,after_data)
  values(coalesce(auth.uid(),case when tg_op='DELETE' then old.updated_by else new.updated_by end),case when auth.uid() is null then 'database_admin' else 'user' end,tg_argv[0],row_id,lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  if tg_op='DELETE' then return old;end if;
  return new;
end;$$;

revoke all on function pcm_private.audit_asset_record() from public,anon,authenticated;

do $$ declare item record; begin
  for item in select * from (values
    ('pcm_property_references','property_references'),
    ('pcm_property_documents','property_documents'),
    ('pcm_lease_documents','lease_documents')
  ) as x(table_name,module) loop
    execute format('alter table public.%I enable row level security',item.table_name);
    execute format('revoke all on public.%I from public,anon,authenticated',item.table_name);
    execute format('grant select,insert,update,delete on public.%I to authenticated',item.table_name);
    execute format('create policy asset_view on public.%I for select to authenticated using ((select pcm_private.has_permission(%L)))',item.table_name,item.module||'.view');
    execute format('create policy asset_create on public.%I for insert to authenticated with check ((select pcm_private.has_permission(%L)) and (select pcm_private.has_permission(%L)))',item.table_name,item.module||'.view',item.module||case when item.module like '%documents' then '.upload' else '.create' end);
    execute format('create policy asset_edit on public.%I for update to authenticated using ((select pcm_private.has_permission(%L)) and (select pcm_private.has_permission(%L))) with check ((select pcm_private.has_permission(%L)) and (select pcm_private.has_permission(%L)))',item.table_name,item.module||'.view',item.module||'.edit',item.module||'.view',item.module||'.edit');
    execute format('create policy asset_delete on public.%I for delete to authenticated using ((select pcm_private.has_permission(%L)) and (select pcm_private.has_permission(%L)))',item.table_name,item.module||'.view',item.module||'.delete');
    execute format('create trigger asset_guard before insert or update or delete on public.%I for each row execute function pcm_private.guard_asset_record(%L)',item.table_name,item.module);
    execute format('create trigger asset_audit after insert or update or delete on public.%I for each row execute function pcm_private.audit_asset_record(%L)',item.table_name,item.module);
  end loop;
end;$$;

-- PDF metadata mutations are server-only. End users can only read rows allowed by RLS.
revoke insert,update,delete on public.pcm_property_documents,public.pcm_lease_documents from authenticated;
drop policy asset_create on public.pcm_property_documents;
drop policy asset_edit on public.pcm_property_documents;
drop policy asset_delete on public.pcm_property_documents;
drop policy asset_create on public.pcm_lease_documents;
drop policy asset_edit on public.pcm_lease_documents;
drop policy asset_delete on public.pcm_lease_documents;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pcm-private-documents','pcm-private-documents',false,20971520,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Storage has no end-user policies: files are accessed only by authorized server routes.
