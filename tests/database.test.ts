import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { allPermissions } from '../src/lib/permissions';

test('administrative schema: real SQL/RLS and audit with isolated local Auth fixtures',async()=>{
  const db=new PGlite();
  const admin='10000000-0000-4000-8000-000000000001';
  const other='10000000-0000-4000-8000-000000000002';
  const session='20000000-0000-4000-8000-000000000001';
  const otherSession='20000000-0000-4000-8000-000000000002';
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
      insert into public.pcm_members(id,name,email,active,is_admin,permissions) values('${admin}','Admin','admin@example.test',true,true,'{}'),('${other}','Other','other@example.test',true,false,'{landlords.view}');
      grant usage on schema public,auth,pcm_private to authenticated,anon;
      grant select on public.pcm_members to authenticated;
      alter table public.pcm_members enable row level security;
      create policy member_read on public.pcm_members for select to authenticated using(true);
    `);
    for(const code of allPermissions) await db.query('insert into pcm_permission_catalog values($1)',[code]);
    await db.exec(await readFile(new URL('./fixtures/access-functions.sql',import.meta.url),'utf8'));
    await db.exec(`create trigger member_guard before insert or update or delete on public.pcm_members for each row execute function pcm_private.guard_member();
      create trigger member_audit after insert or update on public.pcm_members for each row execute function pcm_private.audit_member();
      create trigger audit_guard before update or delete on public.pcm_audit_events for each row execute function pcm_private.prevent_audit_mutation();`);
    await db.exec(await readFile(new URL('../database/administrative_modules.sql',import.meta.url),'utf8'));
    async function asUser(uid:string,sid:string,sql:string) {
      await db.exec('begin');
      try {
        await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:uid,session_id:sid})]);
        await db.exec('set local role authenticated');
        return await db.exec(sql);
      } finally {await db.exec('rollback');}
    }
    const landlord='30000000-0000-4000-8000-000000000001';
    const create=`insert into pcm_landlords(id,name,document_type,document_number) values('${landlord}','Test owner','CC','123456');`;
    const results=await asUser(admin,session,`${create}
      insert into pcm_tenants(name,document_type,document_number) values('Test tenant','CC','654321');
      insert into pcm_properties(name,address,property_type,landlord_id) values('Test home','Test street','casa','${landlord}');
      update pcm_landlords set name='Updated owner' where id='${landlord}' and version=1;
      update pcm_landlords set active=false where id='${landlord}' and version=2;
      select version,active from pcm_landlords where id='${landlord}';`);
    assert.deepEqual(results.at(-1)?.rows,[{version:3,active:false}]);
    await assert.rejects(asUser(other,otherSession,create),/row-level security|no autorizada/);
    await assert.rejects(asUser(admin,otherSession,create),/row-level security|no autorizada/);
    await assert.rejects(asUser(admin,session,`${create} delete from pcm_landlords;`),/permission denied/);
    await assert.rejects(asUser(admin,session,`${create} update pcm_landlords set id=gen_random_uuid();`),/inmutable/);
    await assert.rejects(asUser(admin,session,`${create} update pcm_landlords set version=80;`),/versión/);
    await assert.rejects(asUser(admin,session,`${create} insert into pcm_landlords(name,document_type,document_number) values('Duplicate','CC','123456');`),/unique/);
    await assert.rejects(asUser(admin,session,`update pcm_members set is_admin=false where id='${admin}';`),/permission denied/);
    await assert.rejects(asUser(admin,session,`select pcm_save_member('${admin}','admin@example.test','Self',true,false,'{}',(select updated_at from pcm_members where id='${admin}'));`),/propios permisos/);
    await assert.rejects(asUser(other,otherSession,`select pcm_save_member(null,'new@example.test','User',true,true,'{}',null);`),/no autorizada/);
    const changed=await asUser(admin,session,`select pcm_save_member('${other}','other@example.test','Updated user',false,false,'{landlords.view}',(select updated_at from pcm_members where id='${other}'));select name,active from pcm_members where id='${other}';`);
    assert.deepEqual(changed.at(-1)?.rows,[{name:'Updated user',active:false}]);
    await db.exec("insert into auth.users values('10000000-0000-4000-8000-000000000003','new@example.test',now(),false,null);");
    const linked=await asUser(admin,session,"select pcm_save_member(null,'new@example.test','New member',true,false,'{tenants.view}',null);select active,is_admin,permissions from pcm_members where email='new@example.test';");
    assert.deepEqual(linked.at(-1)?.rows,[{active:true,is_admin:false,permissions:['tenants.view']}]);
    await assert.rejects(asUser(admin,session,`select pcm_save_member('${other}','other@example.test','Changed',true,false,'{}','2000-01-01');`),/usuario cambió/);
    await db.exec(`update pcm_members set permissions='{users.view,users.manage,users.invite,landlords.view,landlords.archive}' where id='${other}';`);
    await assert.rejects(asUser(other,otherSession,`select pcm_save_member('${admin}','admin@example.test','Admin',true,false,'{}',(select updated_at from pcm_members where id='${admin}'));`),/administrador/);
    await db.exec('begin');
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:admin,session_id:session})]);
    await db.exec(`set local role authenticated;${create}reset role;`);
    const audit=await db.query('select actor_id,action from pcm_audit_events where entity=$1',['landlords']);
    assert.deepEqual(audit.rows,[{actor_id:admin,action:'insert'}]);
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:other,session_id:otherSession})]);
    await db.exec(`set local role authenticated;update pcm_landlords set active=false where id='${landlord}';reset role;`);
    await db.exec('commit');
    await assert.rejects(asUser(other,otherSession,`update pcm_landlords set name='Escalation' where id='${landlord}';`),/permiso para editar/);
    await db.exec('begin;set local role anon');
    await assert.rejects(db.exec('select * from pcm_landlords'),/permission denied/);
    await db.exec('rollback');
  } finally {await db.close();}
});
