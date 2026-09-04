-- Snapshot of deployed access functions; no production users or credentials.
CREATE OR REPLACE FUNCTION pcm_private.audit_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.pcm_audit_events(actor_id,actor_kind,entity,entity_id,action,before_data,after_data)
  values (
    (select auth.uid()), case when (select auth.uid()) is null then 'database_admin' else 'user' end,
    'member',new.id,lower(tg_op),
    case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new)
  );
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION pcm_private.prevent_audit_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  raise exception 'El historial de auditoría es de solo anexado.' using errcode='23514';
end;
$function$
;
CREATE OR REPLACE FUNCTION pcm_private.has_permission(requested_permission text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.pcm_members m
      join auth.users u on u.id=m.id
      where m.id=(select auth.uid()) and m.active
        and u.email_confirmed_at is not null
        and not coalesce(u.is_anonymous,false)
        and (u.banned_until is null or u.banned_until <= now())
        and exists (
          select 1 from auth.sessions s
          where s.user_id=m.id
            and s.id::text=(select auth.jwt()->>'session_id')
            and (s.not_after is null or s.not_after > now())
        )
        and (
          requested_permission is null
          or (
            exists (select 1 from public.pcm_permission_catalog p where p.code=requested_permission)
            and (m.is_admin or requested_permission=any(m.permissions))
          )
        )
    );
$function$
;
CREATE OR REPLACE FUNCTION pcm_private.guard_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  auth_email text;
  confirmed boolean;
begin
  if tg_op='DELETE' then
    raise exception 'Los usuarios se inactivan; no se eliminan del historial.' using errcode='23514';
  end if;
  -- Serialize membership mutations, including promotions, to protect the last admin.
  perform pg_catalog.pg_advisory_xact_lock(724031,1);
  if tg_op='UPDATE' then
    if new.id<>old.id or new.created_at<>old.created_at then
      raise exception 'La identidad y fecha de creación son inmutables.' using errcode='23514';
    end if;
    if old.active and old.is_admin and not (new.active and new.is_admin)
      and not exists (
        select 1 from public.pcm_members m
        where m.id<>old.id and m.active and m.is_admin
      ) then
      raise exception 'Debe permanecer al menos un administrador activo.' using errcode='23514';
    end if;
  end if;
  select lower(u.email), u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    into auth_email, confirmed from auth.users u where u.id=new.id;
  if auth_email is null or new.email is distinct from auth_email then
    raise exception 'El correo debe coincidir con la identidad de Supabase Auth.' using errcode='23514';
  end if;
  if new.active and not coalesce(confirmed,false) then
    raise exception 'La identidad debe estar confirmada antes de activar el acceso.' using errcode='23514';
  end if;
  if new.permissions is null or array_position(new.permissions,null) is not null
    or exists (
      select 1 from unnest(new.permissions) p(code)
      where not exists (select 1 from public.pcm_permission_catalog c where c.code=p.code)
    )
    or cardinality(new.permissions)<>(select count(distinct p) from unnest(new.permissions) p)
  then
    raise exception 'La lista de permisos no es válida.' using errcode='23514';
  end if;
  new.updated_at=now();
  return new;
end;
$function$
;
