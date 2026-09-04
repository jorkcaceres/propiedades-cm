-- Date-only payments. Apply after payments_receipts.sql.
-- Drop only obsolete period columns, with a historical-preservation precondition.
-- No CASCADE, no change to financial immutability, RLS, permissions or stored receipts.
do $$ begin
 if exists (
  select 1 from public.pcm_payments
  where (period_start is not null and snapshot->>'period_start' is distinct from period_start::text)
     or (period_end is not null and snapshot->>'period_end' is distinct from period_end::text)
 ) then
  raise exception 'Historical periods must be preserved in snapshots before removing columns.';
 end if;
end; $$;

create or replace function pcm_private.record_payment(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
    or old_payment.payer_name is distinct from btrim(payload->>'payer_name') or old_payment.reference is distinct from coalesce(btrim(payload->>'reference'),'')
    or old_payment.notes is distinct from coalesce(btrim(payload->>'notes'),'') then raise exception 'La solicitud ya fue utilizada con otros datos.' using errcode='P0001';end if;
  return old_payment.id;
 end if;
 select * into lease from public.pcm_leases where id=(payload->>'lease_id')::uuid for update;
 if not found or not lease.active then raise exception 'Selecciona un arrendamiento activo.' using errcode='P0001';end if;
 if (payload->>'paid_on')::date>(now() at time zone 'America/Bogota')::date then raise exception 'No puedes registrar un pago recibido en una fecha futura.' using errcode='P0001';end if;
 payer=btrim(payload->>'payer_name');
 select jsonb_build_object('property_name',p.name,'property_address',p.address,'tenant_name',t.name,'landlord_name',l.name,
 'payer_name',payer,'amount',(payload->>'amount')::bigint,'concept',payload->>'concept','paid_on',(payload->>'paid_on')::date,
 'method',payload->>'method',
 'reference',coalesce(btrim(payload->>'reference'),''),'currency','COP') into snap
 from public.pcm_properties p,public.pcm_tenants t,public.pcm_landlords l where p.id=lease.property_id and t.id=lease.tenant_id and l.id=lease.landlord_id;
 insert into public.pcm_payments(request_id,lease_id,amount,concept,paid_on,method,reference,payer_name,notes,snapshot,created_by)
 values((payload->>'request_id')::uuid,lease.id,(payload->>'amount')::bigint,payload->>'concept',(payload->>'paid_on')::date,
 payload->>'method',coalesce(btrim(payload->>'reference'),''),payer,coalesce(btrim(payload->>'notes'),''),snap,auth.uid()) returning id into new_id;
 return new_id;
end; $$;

create or replace function pcm_private.issue_receipt(target_payment uuid) returns text language plpgsql security definer set search_path='' as $$
declare payment public.pcm_payments; result_code text;
begin
 if auth.uid() is null or not pcm_private.has_permission('receipts.issue') or not pcm_private.has_permission('receipts.view') or not pcm_private.has_permission('payments.view') then raise exception 'Operación no autorizada.' using errcode='42501';end if;
 select * into payment from public.pcm_payments where id=target_payment for update;
 if not found or payment.voided_at is not null then raise exception 'El pago no está disponible para emitir un recibo.' using errcode='P0001';end if;
 select code into result_code from public.pcm_receipts where payment_id=payment.id;
 if result_code is not null then return result_code;end if;
 loop
  insert into public.pcm_receipts(payment_id,code,snapshot,issued_by)
  values(payment.id,'PCM-'||upper(replace(gen_random_uuid()::text,'-','')),payment.snapshot-array['period_start','period_end'],auth.uid())
  on conflict(code) do nothing returning code into result_code;
  exit when result_code is not null;
 end loop;return result_code;
end; $$;

create or replace function pcm_verification.lookup(receipt_code text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('code',r.code,'amount',p.amount,'concept',p.concept,'paid_on',p.paid_on,'issued_at',r.issued_at,'voided',p.voided_at is not null)
 from public.pcm_receipts r join public.pcm_payments p on p.id=r.payment_id
 where receipt_code ~ '^PCM-[0-9A-F]{32}$' and r.code=receipt_code;
$$;

alter table public.pcm_payments drop constraint pcm_payments_check;
alter table public.pcm_payments drop column period_start, drop column period_end;
alter table public.pcm_receipts drop constraint pcm_receipts_renderer_version_check;
alter table public.pcm_receipts add constraint pcm_receipts_renderer_version_check check(renderer_version in (1,2));
alter table public.pcm_receipts alter column renderer_version set default 2;
comment on column public.pcm_payments.paid_on is 'Date money was received; payments are not allocated to billing months or periods.';
-- CREATE OR REPLACE preserves existing function ACLs. Public wrappers remain invokers.
notify pgrst, 'reload schema';
