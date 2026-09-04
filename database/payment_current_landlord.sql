-- New payments capture the property's current landlord at registration.
-- Existing payment/receipt snapshots and lease terms remain unchanged.
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
 from public.pcm_properties p,public.pcm_tenants t,public.pcm_landlords l where p.id=lease.property_id and t.id=lease.tenant_id and l.id=p.landlord_id;
 insert into public.pcm_payments(request_id,lease_id,amount,concept,paid_on,method,reference,payer_name,notes,snapshot,created_by)
 values((payload->>'request_id')::uuid,lease.id,(payload->>'amount')::bigint,payload->>'concept',(payload->>'paid_on')::date,
 payload->>'method',coalesce(btrim(payload->>'reference'),''),payer,coalesce(btrim(payload->>'notes'),''),snap,auth.uid()) returning id into new_id;
 return new_id;
end; $$;

-- Existing function ACLs, session checks, idempotency and immutable records are preserved.
