import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { allPermissions } from '../src/lib/permissions';
import { amountWords,leaseInput,paymentInput,receiptCode } from '../src/lib/finance';
test('financial inputs reject invalid dates, fractions, extra fields and malformed receipt codes',()=>{
 const lease={action:'create',property_id:crypto.randomUUID(),tenant_id:crypto.randomUUID(),monthly_rent:650000,start_date:'2026-01-01',end_date:null,due_day:5};
 assert.ok(leaseInput.safeParse(lease).success);
 for(const change of [{monthly_rent:1.2},{end_date:'2025-01-01'},{start_date:'2026-02-30'},{due_day:32},{is_admin:true}])assert.equal(leaseInput.safeParse({...lease,...change}).success,false);
 const payment={request_id:crypto.randomUUID(),lease_id:crypto.randomUUID(),amount:650000,concept:'rent',paid_on:'2026-09-01',period_start:'2026-09-01',period_end:'2026-09-30',method:'transfer',payer_name:'Test tenant'};
 assert.ok(paymentInput.safeParse(payment).success);
 for(const change of [{amount:0},{amount:2.5},{concept:'deposit'},{period_end:'2026-08-01'},{snapshot:{amount:1}}])assert.equal(paymentInput.safeParse({...payment,...change}).success,false);
 assert.ok(receiptCode.safeParse('PCM-'+crypto.randomUUID().replaceAll('-','').toUpperCase()).success);
 assert.equal(receiptCode.safeParse('PCM-0001').success,false);
});
test('COP amount in words without rounding or singular errors',()=>{
 assert.equal(amountWords(1),'un peso colombiano');
 assert.equal(amountWords(650000),'seiscientos cincuenta mil pesos colombianos');
 assert.equal(amountWords(21001),'veintiún mil un pesos colombianos');
 assert.equal(amountWords(1000000),'un millón de pesos colombianos');
 assert.equal(amountWords(999999999),'novecientos noventa y nueve millones novecientos noventa y nueve mil novecientos noventa y nueve pesos colombianos');
 assert.throws(()=>amountWords(1.2));
});
test('financial SQL: authorization, immutability, idempotency, snapshots, public privacy and void state',async()=>{
 const db=new PGlite();
 const admin='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',session='20000000-0000-4000-8000-000000000001',otherSession='20000000-0000-4000-8000-000000000002';
 const owner=crypto.randomUUID(),tenant=crypto.randomUUID(),home=crypto.randomUUID();
 async function run(role:string,uid:string|null,sid:string|null,sql:string,params:unknown[]=[]) {
  await db.exec('begin');
  try {await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:uid,session_id:sid})]);await db.exec(`set local role ${role}`);const result=await db.query(sql,params);await db.exec('commit');return result.rows as Record<string,any>[];}
  catch(error){await db.exec('rollback');throw error;}
 }
 const asAdmin=(sql:string,params:unknown[]=[])=>run('authenticated',admin,session,sql,params);
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema pcm_private;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean,banned_until timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   create table public.pcm_members(id uuid primary key,name text not null,email text unique,active boolean,is_admin boolean,permissions text[],created_at timestamptz default now(),updated_at timestamptz default now());
   create table public.pcm_permission_catalog(code text primary key);
   create table public.pcm_audit_events(id uuid default gen_random_uuid(),occurred_at timestamptz default now(),actor_id uuid,actor_kind text,entity text,entity_id uuid,action text,before_data jsonb,after_data jsonb);
   insert into auth.users values('${admin}','admin@example.test',now(),false,null),('${other}','other@example.test',now(),false,null);
   insert into auth.sessions values('${session}','${admin}',null),('${otherSession}','${other}',null);
   insert into pcm_members(id,name,email,active,is_admin,permissions) values('${admin}','Admin','admin@example.test',true,true,'{}'),('${other}','Other','other@example.test',true,false,'{payments.view,receipts.view}');
   grant usage on schema public,auth,pcm_private to authenticated;
   grant usage on schema public,auth to anon;`);
  for(const permission of allPermissions)await db.query('insert into pcm_permission_catalog values($1)',[permission]);
  await db.exec(await readFile(new URL('./fixtures/access-functions.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../database/administrative_modules.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../database/payments_receipts.sql',import.meta.url),'utf8'));
  await asAdmin("insert into pcm_landlords(id,name,document_type,document_number) values($1,'Owner original','CC','123456')",[owner]);
  await asAdmin("insert into pcm_tenants(id,name,document_type,document_number) values($1,'Tenant original','CC','654321')",[tenant]);
  await asAdmin("insert into pcm_properties(id,name,address,property_type,landlord_id) values($1,'Home original','Private address','casa',$2)",[home,owner]);
  const leasePayload={action:'create',property_id:home,tenant_id:tenant,monthly_rent:650000,start_date:'2026-01-01',end_date:null,due_day:5};
  const lease=(await asAdmin('select pcm_save_lease($1) as id',[leasePayload]))[0].id;
  await assert.rejects(asAdmin('select pcm_save_lease($1)',[leasePayload]),/unique/);
  const payload={request_id:crypto.randomUUID(),lease_id:lease,amount:650000,concept:'rent',paid_on:'2026-01-05',period_start:'2026-01-01',period_end:'2026-01-31',method:'transfer',payer_name:'Custom payer',reference:'private-reference',notes:'internal note'};
  await assert.rejects(run('authenticated',other,otherSession,'select pcm_record_payment($1)',[payload]),/no autorizada/);
  await assert.rejects(run('authenticated',admin,otherSession,'select pcm_record_payment($1)',[payload]),/no autorizada/);
  await assert.rejects(asAdmin('select pcm_record_payment($1)',[{...payload,paid_on:'2099-01-01'}]),/fecha futura/);
  await assert.rejects(asAdmin('select pcm_record_payment($1)',[{...payload,concept:'deposit'}]),/check constraint/);
  const payment=(await asAdmin('select pcm_record_payment($1) as id',[payload]))[0].id;
  assert.equal((await asAdmin('select pcm_record_payment($1) as id',[payload]))[0].id,payment);
  await assert.rejects(asAdmin('select pcm_record_payment($1)',[{...payload,amount:1}]),/otros datos/);
  await assert.rejects(asAdmin('update pcm_payments set amount=1 where id=$1',[payment]),/permission denied/);
  await assert.rejects(db.query('update pcm_payments set amount=1 where id=$1',[payment]),/inmutable/);
  await assert.rejects(db.query('delete from pcm_payments where id=$1',[payment]),/inmutable/);
  await assert.rejects(asAdmin('select pcm_save_lease($1)',[{...leasePayload,action:'edit',id:lease,version:1,monthly_rent:700000}]),/no se pueden sobrescribir/);
  await assert.rejects(run('authenticated',other,otherSession,'select pcm_issue_receipt($1)',[payment]),/no autorizada/);
  const code=(await asAdmin('select pcm_issue_receipt($1) as code',[payment]))[0].code;
  assert.match(code,/^PCM-[0-9A-F]{32}$/);
  assert.equal((await asAdmin('select pcm_issue_receipt($1) as code',[payment]))[0].code,code);
  await asAdmin("update pcm_tenants set name='Renamed tenant' where id=$1",[tenant]);
  const snapshot=(await asAdmin('select snapshot from pcm_receipts where code=$1',[code]))[0].snapshot;
  assert.equal(snapshot.tenant_name,'Tenant original');assert.equal(snapshot.payer_name,'Custom payer');assert.equal(snapshot.amount,650000);
  await assert.rejects(db.query("update pcm_receipts set snapshot='{}' where code=$1",[code]),/inmutable/);
  await assert.rejects(run('anon',null,null,'select * from pcm_receipts'),/permission denied/);
  await assert.rejects(run('anon',null,null,'select pcm_record_payment($1)',[payload]),/permission denied/);
  const verification=(await run('anon',null,null,'select pcm_verify_receipt($1) as receipt',[code]))[0].receipt;
  assert.deepEqual(Object.keys(verification).sort(),['amount','code','concept','issued_at','paid_on','period_end','period_start','voided'].sort());
  assert.equal(verification.voided,false);assert.equal(verification.amount,650000);
  assert.equal((await run('anon',null,null,'select pcm_verify_receipt($1) as receipt',['PCM-0001']))[0].receipt,null);
  await assert.rejects(run('authenticated',other,otherSession,'select pcm_void_payment($1,$2)',[payment,'Wrong amount']),/no autorizada/);
  await db.query("update pcm_members set permissions='{payments.view,payments.void}' where id=$1",[other]);
  await assert.rejects(run('authenticated',other,otherSession,'select pcm_void_payment($1,$2)',[payment,'Wrong amount']),/no autorizada/);
  await asAdmin('select pcm_void_payment($1,$2)',[payment,'Wrong amount recorded']);
  await asAdmin('select pcm_void_payment($1,$2)',[payment,'Wrong amount recorded']);
  assert.equal((await run('anon',null,null,'select pcm_verify_receipt($1) as receipt',[code]))[0].receipt.voided,true);
  await assert.rejects(asAdmin('select pcm_issue_receipt($1)',[payment]),/no está disponible/);
  const audits=await db.query("select action,actor_id from pcm_audit_events where entity='payments' and entity_id=$1 order by occurred_at",[payment]);
  assert.deepEqual(audits.rows,[{action:'insert',actor_id:admin},{action:'update',actor_id:admin}]);
  await asAdmin('select pcm_save_lease($1)',[{action:'archive',id:lease,version:1,active:false}]);
  await assert.rejects(asAdmin('select pcm_record_payment($1)',[{...payload,request_id:crypto.randomUUID()}]),/arrendamiento activo/);
 }finally{await db.close();}
});
