import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, loginInput } from '../src/lib/auth-flow';
import { authEnabled } from '../src/lib/release';
import { HttpError } from '../src/lib/errors';

const input = {email:'  ADMIN@example.com ',password:' keep spaces ',turnstileToken:'captcha-token'};
const user = {id:'member-id',email_confirmed_at:'2026-09-04T00:00:00Z',is_anonymous:false};
function fixture(options: {
  authError?: {code?:string;status?:number}; user?: unknown; session?: unknown;
  member?: unknown; memberError?: unknown;
} = {}) {
  const calls: unknown[] = [];
  const selected: string[] = [];
  const signedOut: unknown[] = [];
  const query = {
    select(columns:string) {selected.push(columns);return this;},
    eq(column:string,value:string) {assert.equal(column,'id');assert.equal(value,user.id);return this;},
    async maybeSingle() {return {data:'member' in options?options.member:{id:user.id,active:true},error:options.memberError||null};},
  };
  const client = {
    auth: {
      async signInWithPassword(credentials:unknown) {calls.push(credentials);return {data:{user:'user' in options?options.user:user,session:'session' in options?options.session:{access_token:'test-only'}},error:options.authError||null};},
      async signOut(scope:unknown) {signedOut.push(scope);return {error:null};},
    },
    from(table:string) {assert.equal(table,'pcm_members');return query;},
  } as unknown as SupabaseClient;
  return {client,calls,selected,signedOut};
}

test('login stays closed unless explicitly enabled with all public configuration',()=>{
  const env = {PCM_AUTH_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-key',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'site-key'};
  assert.equal(authEnabled(env),true);
  for(const key of Object.keys(env)) assert.equal(authEnabled({...env,[key]:''}),false);
  assert.equal(authEnabled({...env,PCM_AUTH_ENABLED:'false'}),false);
  assert.equal(authEnabled({...env,NEXT_PUBLIC_SUPABASE_URL:'http://example.supabase.co'}),false);
  assert.equal(authEnabled({...env,NEXT_PUBLIC_SUPABASE_URL:'invalid'}),false);
});

test('login normalizes email but preserves the exact password',()=>{
  assert.deepEqual(loginInput.parse(input),{...input,email:'admin@example.com'});
});

test('input rejects missing/oversized captcha, malformed email, empty password and injected fields',()=>{
  for(const patch of [{turnstileToken:''},{turnstileToken:'x'.repeat(2049)},{email:'invalid'},{password:''},{is_admin:true}]) {
    assert.equal(loginInput.safeParse({...input,...patch}).success,false);
  }
});

test('authorized login sends captcha only to Supabase and checks membership',async()=>{
  const f=fixture(); await authenticate(f.client,input);
  assert.deepEqual(f.calls,[{email:'admin@example.com',password:input.password,options:{captchaToken:input.turnstileToken}}]);
  assert.deepEqual(f.selected,['id,active']);
  assert.deepEqual(f.signedOut,[]);
});

for(const [name,error,status] of [
  ['invalid credentials',{code:'invalid_credentials',status:400},401],
  ['captcha failure',{code:'captcha_failed',status:400},403],
  ['rate limit',{status:429},429],
  ['provider unavailable',{status:503},503],
] as const) {
  test(`${name} returns a safe error without querying membership`,async()=>{
    const f=fixture({authError:error});
    await assert.rejects(authenticate(f.client,input),(e:unknown)=>e instanceof HttpError&&e.status===status);
    assert.deepEqual(f.selected,[]);
  });
}

for(const [name,options,status] of [
  ['inactive member',{member:{id:user.id,active:false}},403],
  ['missing member',{member:null},403],
  ['different member',{member:{id:'other-id',active:true}},403],
  ['membership lookup failure',{memberError:{message:'private database detail'}},503],
  ['unconfirmed email',{user:{...user,email_confirmed_at:null}},403],
  ['anonymous account',{user:{...user,is_anonymous:true}},403],
  ['missing auth session',{session:null},403],
  ['self-assigned metadata',{user:{...user,user_metadata:{is_admin:true}},member:null},403],
] as const) {
  test(`${name} denies access and revokes the new session`,async()=>{
    const f=fixture(options);
    await assert.rejects(authenticate(f.client,input),(e:unknown)=>e instanceof HttpError&&e.status===status&&!e.message.includes('private database detail'));
    assert.deepEqual(f.signedOut,[{scope:'local'}]);
  });
}

test('invalid payload never calls the authentication provider',async()=>{
  const f=fixture();
  await assert.rejects(authenticate(f.client,{}));
  assert.deepEqual(f.calls,[]);
});
