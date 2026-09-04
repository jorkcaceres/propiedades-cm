-- Additive migration, applied through the authorized Supabase connector.
-- Requires pcm_access_foundation and pcm_explicit_deny_admin_setup.
create table public.pcm_landlords (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 150),
  document_type text not null check (document_type in ('CC','CE','NIT','PAS','OTRO')),
  document_number text not null check (document_number ~ '^[A-Za-z0-9-]{3,30}$'),
  email text not null default '' check(length(email)<=254),
  phone text not null default '' check(length(phone)<=30),
  address text not null default '' check(length(address)<=250),
  notes text not null default '' check(length(notes)<=2000),
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_type,document_number)
);
create table public.pcm_tenants (like public.pcm_landlords including all);
create table public.pcm_properties (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(btrim(name)) between 2 and 150),
  address text not null check(length(btrim(address)) between 3 and 250),
  neighborhood text not null default '' check(length(neighborhood)<=100),
  city text not null default 'Soledad' check(length(btrim(city)) between 2 and 100),
  department text not null default 'Atlántico' check(length(btrim(department)) between 2 and 100),
  property_type text not null check(property_type in ('casa','apartamento','habitacion','otro')),
  bedrooms integer check(bedrooms between 0 and 99),
  bathrooms integer check(bathrooms between 0 and 99),
  area_m2 numeric(10,2) check(area_m2>0),
  landlord_id uuid not null references public.pcm_landlords(id) on delete restrict,
  notes text not null default '' check(length(notes)<=2000),
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pcm_properties_landlord_idx on public.pcm_properties(landlord_id);

create function pcm_private.guard_record() returns trigger language plpgsql
security invoker set search_path='' as $$
declare module text := tg_argv[0];
begin
  if tg_op='INSERT' then
    if not pcm_private.has_permission(module||'.create') or not new.active then
      raise exception 'Operación no autorizada.' using errcode='42501';
    end if;
    new.version=1; new.created_at=now();
  else
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'La identidad del registro es inmutable.' using errcode='23514';
    end if;
    if new.active is distinct from old.active and not pcm_private.has_permission(module||'.archive') then
      raise exception 'No tienes permiso para cambiar el estado.' using errcode='42501';
    end if;
    if (to_jsonb(new)-array['active','updated_at','version']) is distinct from (to_jsonb(old)-array['active','updated_at','version'])
       and not pcm_private.has_permission(module||'.edit') then
      raise exception 'No tienes permiso para editar.' using errcode='42501';
    end if;
    if new.version<>old.version then
      raise exception 'La versión se genera en el servidor.' using errcode='23514';
    end if;
    new.version=old.version+1;
  end if;
  if tg_table_name='pcm_properties' then
    if tg_op='INSERT' or new.landlord_id is distinct from old.landlord_id or (new.active and not old.active) then
      if not exists(select 1 from public.pcm_landlords where id=new.landlord_id and active) then
        raise exception 'Selecciona un arrendador activo y autorizado.' using errcode='23514';
      end if;
    end if;
  else
    new.document_number=upper(btrim(new.document_number));
  end if;
  new.updated_at=now(); return new;
end; $$;
revoke all on function pcm_private.guard_record() from public,anon,authenticated;

create function pcm_private.audit_record() returns trigger language plpgsql
security definer set search_path='' as $$
begin
  insert into public.pcm_audit_events(actor_id,actor_kind,entity,entity_id,action,before_data,after_data)
  values(auth.uid(),'user',tg_argv[0],new.id,
    case when tg_op='INSERT' then 'insert' when new.active is distinct from old.active then case when new.active then 'restore' else 'archive' end else 'update' end,
    case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
  return new;
end; $$;
revoke all on function pcm_private.audit_record() from public,anon,authenticated;

do $$ declare module text; tbl text; begin
  foreach module in array array['landlords','tenants','properties'] loop
    tbl='pcm_'||module;
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
    execute format('grant select,insert,update on public.%I to authenticated',tbl);
    execute format('create index %I on public.%I(active,name,id)',tbl||'_list_idx',tbl);
    execute format('create policy record_view on public.%I for select to authenticated using ((select pcm_private.has_permission(%L)))',tbl,module||'.view');
    execute format('create policy record_create on public.%I for insert to authenticated with check ((select pcm_private.has_permission(%L)) and (select pcm_private.has_permission(%L)))',tbl,module||'.view',module||'.create');
    execute format('create policy record_update on public.%I for update to authenticated using ((select pcm_private.has_permission(%L)) and ((select pcm_private.has_permission(%L)) or (select pcm_private.has_permission(%L)))) with check ((select pcm_private.has_permission(%L)) and ((select pcm_private.has_permission(%L)) or (select pcm_private.has_permission(%L))))',tbl,module||'.view',module||'.edit',module||'.archive',module||'.view',module||'.edit',module||'.archive');
    execute format('create trigger record_guard before insert or update on public.%I for each row execute function pcm_private.guard_record(%L)',tbl,module);
    execute format('create trigger record_audit after insert or update on public.%I for each row execute function pcm_private.audit_record(%L)',tbl,module);
  end loop;
end; $$;

-- Membership writes stay behind a bounded private function, not direct table grants.
create function pcm_private.save_member(target_id uuid, target_email text, target_name text,
  target_active boolean, target_admin boolean, target_permissions text[], expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.pcm_members; target public.pcm_members; resolved_id uuid; auth_email text;
begin
  perform pg_catalog.pg_advisory_xact_lock(724031,1);
  if auth.uid() is null or not pcm_private.has_permission('users.view') then
    raise exception 'Operación no autorizada.' using errcode='42501';
  end if;
  select * into actor from public.pcm_members where id=auth.uid();
  if target_id is null then
    if not pcm_private.has_permission('users.invite') then raise exception 'Operación no autorizada.' using errcode='42501'; end if;
    select u.id,lower(u.email) into resolved_id,auth_email from auth.users u
      where lower(u.email)=lower(btrim(target_email)) and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now());
    if resolved_id is null then raise exception 'Primero crea y confirma esta cuenta en Supabase Auth.' using errcode='P0001'; end if;
  else
    if not pcm_private.has_permission('users.manage') then raise exception 'Operación no autorizada.' using errcode='42501'; end if;
    select * into target from public.pcm_members where id=target_id for update;
    if not found or target.updated_at is distinct from expected_updated_at then
      raise exception 'El usuario cambió. Actualiza la lista antes de guardar.' using errcode='P0001';
    end if;
    resolved_id=target.id; auth_email=target.email;
    if resolved_id=actor.id then raise exception 'No puedes modificar tus propios permisos o estado.' using errcode='P0001'; end if;
  end if;
  if target_active is null or target_admin is null or length(btrim(target_name)) not between 2 and 150 then
    raise exception 'Datos del usuario no válidos.' using errcode='23514';
  end if;
  -- Delegated managers cannot alter admins or grant capabilities they do not have.
  if not actor.is_admin and (target_admin or coalesce(target.is_admin,false)
      or not (target_permissions <@ actor.permissions) or not(coalesce(target.permissions,'{}') <@ actor.permissions)
      or target_permissions && array['users.invite','users.manage']) then
    raise exception 'Solo un administrador puede asignar estos permisos.' using errcode='42501';
  end if;
  if target_id is null then
    insert into public.pcm_members(id,name,email,active,is_admin,permissions)
      values(resolved_id,btrim(target_name),auth_email,target_active,target_admin,target_permissions);
  else
    update public.pcm_members set name=btrim(target_name),active=target_active,is_admin=target_admin,permissions=target_permissions where id=resolved_id;
  end if;
  return resolved_id;
end; $$;
revoke all on function pcm_private.save_member(uuid,text,text,boolean,boolean,text[],timestamptz) from public,anon,authenticated;
grant execute on function pcm_private.save_member(uuid,text,text,boolean,boolean,text[],timestamptz) to authenticated;
create function public.pcm_save_member(target_id uuid, target_email text, target_name text,
  target_active boolean, target_admin boolean, target_permissions text[], expected_updated_at timestamptz)
returns uuid language sql security invoker set search_path='' as $$
  select pcm_private.save_member(target_id,target_email,target_name,target_active,target_admin,target_permissions,expected_updated_at);
$$;
revoke all on function public.pcm_save_member(uuid,text,text,boolean,boolean,text[],timestamptz) from public,anon,authenticated;
grant execute on function public.pcm_save_member(uuid,text,text,boolean,boolean,text[],timestamptz) to authenticated;
