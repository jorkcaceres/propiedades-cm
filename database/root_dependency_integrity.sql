-- Production integrity rules: a property's current landlord is the operational source of truth.
-- Financial snapshots remain immutable and are intentionally not synchronized.
create or replace function pcm_private.sync_lease_landlord_from_property() returns trigger
language plpgsql security definer set search_path='' as $$
declare current_landlord_id uuid;
begin
  select landlord_id into current_landlord_id from public.pcm_properties where id=new.property_id;
  if current_landlord_id is null then raise exception 'La vivienda seleccionada no tiene un arrendador válido.' using errcode='P0001';end if;
  new.landlord_id=current_landlord_id;return new;
end;$$;
revoke all on function pcm_private.sync_lease_landlord_from_property() from public;
drop trigger if exists lease_sync_landlord_from_property on public.pcm_leases;
create trigger lease_sync_landlord_from_property before insert or update of property_id,landlord_id on public.pcm_leases
for each row execute function pcm_private.sync_lease_landlord_from_property();

create or replace function pcm_private.propagate_property_landlord_to_leases() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.landlord_id is distinct from old.landlord_id then
    update public.pcm_leases set landlord_id=new.landlord_id,version=version+1,updated_at=now()
    where property_id=new.id and landlord_id is distinct from new.landlord_id;
  end if;return new;
end;$$;
revoke all on function pcm_private.propagate_property_landlord_to_leases() from public;
drop trigger if exists property_propagate_landlord_to_leases on public.pcm_properties;
create trigger property_propagate_landlord_to_leases after update of landlord_id on public.pcm_properties
for each row execute function pcm_private.propagate_property_landlord_to_leases();

create or replace function pcm_private.sync_member_email_from_auth() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.email is not null and new.email is distinct from old.email then
    update public.pcm_members set email=lower(btrim(new.email)) where id=new.id and email is distinct from lower(btrim(new.email));
  end if;return new;
end;$$;
revoke all on function pcm_private.sync_member_email_from_auth() from public;
drop trigger if exists pcm_sync_member_email on auth.users;
create trigger pcm_sync_member_email after update of email on auth.users for each row execute function pcm_private.sync_member_email_from_auth();

create or replace function pcm_private.guard_record() returns trigger language plpgsql set search_path='' as $$
declare module text:=tg_argv[0];
begin
  if tg_op='INSERT' then
    if not pcm_private.has_permission(module||'.create') or not new.active then raise exception 'Operación no autorizada.' using errcode='42501';end if;
    new.version=1;new.created_at=now();
  else
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then raise exception 'La identidad del registro es inmutable.' using errcode='23514';end if;
    if new.active is distinct from old.active and not pcm_private.has_permission(module||'.archive') then raise exception 'No tienes permiso para cambiar el estado.' using errcode='42501';end if;
    if (to_jsonb(new)-array['active','updated_at','version']) is distinct from (to_jsonb(old)-array['active','updated_at','version']) and not pcm_private.has_permission(module||'.edit') then raise exception 'No tienes permiso para editar.' using errcode='42501';end if;
    if new.version<>old.version then raise exception 'La versión se genera en el servidor.' using errcode='23514';end if;
    if old.active and not new.active then
      if tg_table_name='pcm_properties' and exists(select 1 from public.pcm_leases where property_id=old.id and active) then
        raise exception 'No puedes inactivar esta vivienda mientras tenga un arrendamiento activo.' using errcode='23514';
      elsif tg_table_name='pcm_tenants' and exists(select 1 from public.pcm_leases where tenant_id=old.id and active) then
        raise exception 'No puedes inactivar este arrendatario mientras tenga un arrendamiento activo.' using errcode='23514';
      elsif tg_table_name='pcm_landlords' and exists(select 1 from public.pcm_properties p join public.pcm_leases l on l.property_id=p.id and l.active where p.landlord_id=old.id) then
        raise exception 'No puedes inactivar este arrendador mientras tenga un arrendamiento activo.' using errcode='23514';
      end if;
    end if;
    new.version=old.version+1;
  end if;
  if tg_table_name='pcm_properties' then
    if tg_op='INSERT' or new.landlord_id is distinct from old.landlord_id or (new.active and not old.active) then
      if not exists(select 1 from public.pcm_landlords where id=new.landlord_id and active) then raise exception 'Selecciona un arrendador activo y autorizado.' using errcode='23514';end if;
    end if;
  else new.document_number=upper(btrim(new.document_number));end if;
  new.updated_at=now();return new;
end;$$;
