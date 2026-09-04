-- Additive financial module; apply through Supabase connector after administrative_modules.
create table public.pcm_leases (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.pcm_properties(id) on delete restrict,
 landlord_id uuid not null references public.pcm_landlords(id) on delete restrict, tenant_id uuid not null references public.pcm_tenants(id) on delete restrict,
 monthly_rent bigint not null check(monthly_rent between 1 and 999999999),start_date date not null,end_date date,
 due_day integer not null check(due_day between 1 and 31),active boolean not null default true,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(end_date is null or end_date>=start_date)
);
create unique index pcm_lease_active_property on public.pcm_leases(property_id) where active;
create index pcm_lease_property_idx on public.pcm_leases(property_id);
create index pcm_lease_tenant_idx on public.pcm_leases(tenant_id);
create index pcm_lease_landlord_idx on public.pcm_leases(landlord_id);
create table public.pcm_payments (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 lease_id uuid not null references public.pcm_leases(id) on delete restrict,
 amount bigint not null check(amount between 1 and 999999999),concept text not null check(concept in ('rent','advance','deposit')),
 paid_on date not null,period_start date,period_end date,method text not null check(method in ('transfer','cash','other')),
 reference text not null default '' check(length(reference)<=120),payer_name text not null check(length(btrim(payer_name)) between 2 and 150),
 notes text not null default '' check(length(notes)<=500),snapshot jsonb not null,
 created_by uuid not null references public.pcm_members(id) on delete restrict,created_at timestamptz not null default now(),
 voided_at timestamptz,voided_by uuid references public.pcm_members(id) on delete restrict,void_reason text,
 check((concept='deposit' and period_start is null and period_end is null) or
       (concept in ('rent','advance') and period_start is not null and period_end is not null and period_end>=period_start)),
 check((voided_at is null and voided_by is null and void_reason is null) or
       (voided_at is not null and voided_by is not null and length(btrim(void_reason)) between 5 and 500))
);
create index pcm_payment_lease_idx on public.pcm_payments(lease_id);
create index pcm_payment_created_by_idx on public.pcm_payments(created_by);
create index pcm_payment_voided_by_idx on public.pcm_payments(voided_by);
create index pcm_payment_date_idx on public.pcm_payments(paid_on desc,id);
create table public.pcm_receipts (
 id uuid primary key default gen_random_uuid(),payment_id uuid not null unique references public.pcm_payments(id) on delete restrict,
 code text not null unique check(code ~ '^PCM-[0-9A-F]{32}$'),snapshot jsonb not null,
 renderer_version integer not null default 1 check(renderer_version=1),issued_by uuid not null references public.pcm_members(id) on delete restrict,
 issued_at timestamptz not null default now()
);
create index pcm_receipt_issuer_idx on public.pcm_receipts(issued_by);
create index pcm_receipt_date_idx on public.pcm_receipts(issued_at desc,id);
do $$ declare module text; begin
 foreach module in array array['leases','payments','receipts'] loop
  execute format('alter table public.%I enable row level security','pcm_'||module);
  execute format('revoke all on public.%I from public,anon,authenticated','pcm_'||module);
  execute format('grant select on public.%I to authenticated','pcm_'||module);
  execute format('create policy financial_read on public.%I for select to authenticated using ((select pcm_private.has_permission(%L)))','pcm_'||module,module||'.view');
 end loop;
end; $$;

create function pcm_private.financial_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.pcm_audit_events(actor_id,actor_kind,entity,entity_id,action,before_data,after_data)
 values(auth.uid(),case when auth.uid() is null then 'database_admin' else 'user' end,tg_argv[0],new.id,lower(tg_op),
 case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end; $$;
revoke all on function pcm_private.financial_audit() from public,anon,authenticated;
create trigger lease_audit after insert or update on public.pcm_leases for each row execute function pcm_private.financial_audit('leases');
create trigger payment_audit after insert or update on public.pcm_payments for each row execute function pcm_private.financial_audit('payments');
create trigger receipt_audit after insert on public.pcm_receipts for each row execute function pcm_private.financial_audit('receipts');
create function pcm_private.immutable_financial() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='pcm_payments' and tg_op='UPDATE' then
  if old.voided_at is null and new.voided_at is not null
  and (to_jsonb(new)-array['voided_at','voided_by','void_reason'])=(to_jsonb(old)-array['voided_at','voided_by','void_reason']) then return new; end if;
 end if;
 raise exception 'El registro financiero es inmutable.' using errcode='23514';
end; $$;
revoke all on function pcm_private.immutable_financial() from public,anon,authenticated;
create trigger payment_immutable before update or delete on public.pcm_payments for each row execute function pcm_private.immutable_financial();
create trigger receipt_immutable before update or delete on public.pcm_receipts for each row execute function pcm_private.immutable_financial();

create function pcm_private.save_lease(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.pcm_leases; owner_id uuid; result_id uuid; action text:=payload->>'action';
begin
 if auth.uid() is null or not pcm_private.has_permission('leases.view') or action not in ('create','edit','archive') or action is null
 or not pcm_private.has_permission('leases.'||action) then raise exception 'Operación no autorizada.' using errcode='42501';end if;
 if action<>'create' then
  select * into previous from public.pcm_leases where id=(payload->>'id')::uuid for update;
  if not found or previous.version is distinct from (payload->>'version')::integer then raise exception 'Actualiza el registro antes de guardar.' using errcode='P0001';end if;
  if action='archive' then
   update public.pcm_leases set active=(payload->>'active')::boolean,version=version+1,updated_at=now() where id=previous.id;return previous.id;
  end if;
  if exists(select 1 from public.pcm_payments where lease_id=previous.id) then raise exception 'Este arrendamiento ya tiene pagos; sus condiciones no se pueden sobrescribir.' using errcode='P0001';end if;
 end if;
 if not pcm_private.has_permission('properties.view') or not pcm_private.has_permission('tenants.view') or not pcm_private.has_permission('landlords.view') then raise exception 'Operación no autorizada.' using errcode='42501';end if;
 select p.landlord_id into owner_id from public.pcm_properties p join public.pcm_landlords l on l.id=p.landlord_id
 where p.id=(payload->>'property_id')::uuid and p.active and l.active;
 if owner_id is null or not exists(select 1 from public.pcm_tenants where id=(payload->>'tenant_id')::uuid and active) then raise exception 'Selecciona una vivienda y un arrendatario activos.' using errcode='P0001';end if;
 if action='create' then
  insert into public.pcm_leases(property_id,landlord_id,tenant_id,monthly_rent,start_date,end_date,due_day)
  values((payload->>'property_id')::uuid,owner_id,(payload->>'tenant_id')::uuid,(payload->>'monthly_rent')::bigint,(payload->>'start_date')::date,nullif(payload->>'end_date','')::date,(payload->>'due_day')::int) returning id into result_id;
 else
  update public.pcm_leases set property_id=(payload->>'property_id')::uuid,landlord_id=owner_id,tenant_id=(payload->>'tenant_id')::uuid,
   monthly_rent=(payload->>'monthly_rent')::bigint,start_date=(payload->>'start_date')::date,end_date=nullif(payload->>'end_date','')::date,
   due_day=(payload->>'due_day')::int,version=version+1,updated_at=now() where id=previous.id returning id into result_id;
 end if;return result_id;
end; $$;

create function pcm_private.record_payment(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare lease public.pcm_leases; old_payment public.pcm_payments; new_id uuid; snap jsonb; payer text;
begin
 if auth.uid() is null or not pcm_private.has_permission('payments.create') or not pcm_private.has_permission('payments.view') or not pcm_private.has_permission('leases.view') then raise exception 'Operación no autorizada.' using errcode='42501';end if;
 -- One lock per idempotency key. A retry cannot create a second payment.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((payload->>'request_id'),734));
 select * into old_payment from public.pcm_payments where request_id=(payload->>'request_id')::uuid;
 if found then
  if old_payment.created_by<>auth.uid() or old_payment.lease_id is distinct from (payload->>'lease_id')::uuid
    or old_payment.amount is distinct from (payload->>'amount')::bigint or old_payment.concept is distinct from payload->>'concept'
    or old_payment.paid_on is distinct from (payload->>'paid_on')::date or old_payment.method is distinct from payload->>'method'
    or old_payment.period_start is distinct from nullif(payload->>'period_start','')::date or old_payment.period_end is distinct from nullif(payload->>'period_end','')::date
    or old_payment.payer_name is distinct from btrim(payload->>'payer_name') or old_payment.reference is distinct from coalesce(btrim(payload->>'reference'),'')
    or old_payment.notes is distinct from coalesce(btrim(payload->>'notes'),'') then raise exception 'La solicitud ya fue utilizada con otros datos.' using errcode='P0001';end if;
  return old_payment.id;
 end if;
 select * into lease from public.pcm_leases where id=(payload->>'lease_id')::uuid for update;
 if not found or not lease.active then raise exception 'Selecciona un arrendamiento activo.' using errcode='P0001';end if;
 if (payload->>'paid_on')::date>(now() at time zone 'America/Bogota')::date then raise exception 'No puedes registrar un pago recibido en una fecha futura.' using errcode='P0001';end if;
 if payload->>'concept'<>'deposit' and ((payload->>'period_start')::date<lease.start_date or (lease.end_date is not null and (payload->>'period_end')::date>lease.end_date)) then raise exception 'El periodo debe estar dentro del arrendamiento.' using errcode='P0001';end if;
 payer=btrim(payload->>'payer_name');
 select jsonb_build_object('property_name',p.name,'property_address',p.address,'tenant_name',t.name,'landlord_name',l.name,
 'payer_name',payer,'amount',(payload->>'amount')::bigint,'concept',payload->>'concept','paid_on',(payload->>'paid_on')::date,
 'period_start',nullif(payload->>'period_start','')::date,'period_end',nullif(payload->>'period_end','')::date,'method',payload->>'method',
 'reference',coalesce(btrim(payload->>'reference'),''),'currency','COP') into snap
 from public.pcm_properties p,public.pcm_tenants t,public.pcm_landlords l where p.id=lease.property_id and t.id=lease.tenant_id and l.id=lease.landlord_id;
 insert into public.pcm_payments(request_id,lease_id,amount,concept,paid_on,period_start,period_end,method,reference,payer_name,notes,snapshot,created_by)
 values((payload->>'request_id')::uuid,lease.id,(payload->>'amount')::bigint,payload->>'concept',(payload->>'paid_on')::date,
 nullif(payload->>'period_start','')::date,nullif(payload->>'period_end','')::date,payload->>'method',coalesce(btrim(payload->>'reference'),''),payer,coalesce(btrim(payload->>'notes'),''),snap,auth.uid()) returning id into new_id;
 return new_id;
end; $$;

create function pcm_private.issue_receipt(target_payment uuid) returns text language plpgsql security definer set search_path='' as $$
declare payment public.pcm_payments; result_code text;
begin
 if auth.uid() is null or not pcm_private.has_permission('receipts.issue') or not pcm_private.has_permission('receipts.view') or not pcm_private.has_permission('payments.view') then raise exception 'Operación no autorizada.' using errcode='42501';end if;
 select * into payment from public.pcm_payments where id=target_payment for update;
 if not found or payment.voided_at is not null then raise exception 'El pago no está disponible para emitir un recibo.' using errcode='P0001';end if;
 select code into result_code from public.pcm_receipts where payment_id=payment.id;
 if result_code is not null then return result_code;end if;
 loop
  insert into public.pcm_receipts(payment_id,code,snapshot,issued_by)
  values(payment.id,'PCM-'||upper(replace(gen_random_uuid()::text,'-','')),payment.snapshot,auth.uid())
  on conflict(code) do nothing returning code into result_code;
  exit when result_code is not null;
 end loop;return result_code;
end; $$;

create function pcm_private.void_payment(target_payment uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare payment public.pcm_payments;
begin
 if auth.uid() is null or not pcm_private.has_permission('payments.void') or not pcm_private.has_permission('payments.view') then raise exception 'Operación no autorizada.' using errcode='42501';end if;
 select * into payment from public.pcm_payments where id=target_payment for update;
 if not found then raise exception 'El pago no está disponible.' using errcode='P0001';end if;
 if exists(select 1 from public.pcm_receipts where payment_id=payment.id) and not pcm_private.has_permission('receipts.void') then raise exception 'Operación no autorizada.' using errcode='42501';end if;
 if reason is null or length(btrim(reason)) not between 5 and 500 then raise exception 'Indica el motivo de la anulación.' using errcode='P0001';end if;
 if payment.voided_at is not null then return;end if;
 update public.pcm_payments set voided_at=now(),voided_by=auth.uid(),void_reason=btrim(reason) where id=payment.id;
end; $$;

-- Exposed wrappers remain SECURITY INVOKER; privileged operations are bounded and private.
create function public.pcm_save_lease(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select pcm_private.save_lease(payload)$$;
create function public.pcm_record_payment(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select pcm_private.record_payment(payload)$$;
create function public.pcm_issue_receipt(target_payment uuid) returns text language sql security invoker set search_path='' as $$select pcm_private.issue_receipt(target_payment)$$;
create function public.pcm_void_payment(target_payment uuid,reason text) returns void language sql security invoker set search_path='' as $$select pcm_private.void_payment(target_payment,reason)$$;
do $$ declare f text; s text; begin
 foreach s in array array['pcm_private','public'] loop
  foreach f in array array[case when s='public' then 'pcm_' else '' end||'save_lease(jsonb)',case when s='public' then 'pcm_' else '' end||'record_payment(jsonb)',case when s='public' then 'pcm_' else '' end||'issue_receipt(uuid)',case when s='public' then 'pcm_' else '' end||'void_payment(uuid,text)'] loop
   execute format('revoke all on function %s.%s from public,anon,authenticated',s,f);
   execute format('grant execute on function %s.%s to authenticated',s,f);
  end loop;
 end loop;
end; $$;

-- Separate non-exposed schema: anonymous users never gain access to pcm_private.
create schema pcm_verification;
revoke all on schema pcm_verification from public;
grant usage on schema pcm_verification to anon,authenticated;
create function pcm_verification.lookup(receipt_code text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('code',r.code,'amount',p.amount,'concept',p.concept,'paid_on',p.paid_on,'period_start',p.period_start,'period_end',p.period_end,'issued_at',r.issued_at,'voided',p.voided_at is not null)
 from public.pcm_receipts r join public.pcm_payments p on p.id=r.payment_id
 where receipt_code ~ '^PCM-[0-9A-F]{32}$' and r.code=receipt_code;
$$;
revoke all on function pcm_verification.lookup(text) from public,anon,authenticated;
grant execute on function pcm_verification.lookup(text) to anon,authenticated;
create function public.pcm_verify_receipt(receipt_code text) returns jsonb language sql stable security invoker set search_path='' as $$select pcm_verification.lookup(receipt_code)$$;
revoke all on function public.pcm_verify_receipt(text) from public,anon,authenticated;
grant execute on function public.pcm_verify_receipt(text) to anon,authenticated;
comment on function pcm_verification.lookup(text) is 'Intentional bearer-code verification: exact random UUID-derived code only; no lists, names, documents, contact details, addresses or notes.';
