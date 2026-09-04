import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server';
import { stageSessionCookies } from '../src/lib/session-cookies';

test('session cookies are withheld unless the route explicitly commits them',()=>{
  const staged=stageSessionCookies([]);
  staged.cookies.setAll([{name:'sb-test-auth-token',value:'session',options:{}}]);
  const rejected=NextResponse.json({error:'not authorized'},{status:403});
  assert.equal(rejected.headers.get('set-cookie'),null);
  const allowed=staged.commit(NextResponse.json({ok:true}));
  assert.equal(allowed.cookies.get('sb-test-auth-token')?.value,'session');
  assert.equal(allowed.headers.get('cache-control'),'private, no-store');
});

test('server reads staged updates and logout replaces them with an expired cookie',()=>{
  const staged=stageSessionCookies([{name:'sb-test-auth-token',value:'old'}]);
  staged.cookies.setAll([{name:'sb-test-auth-token',value:'new',options:{maxAge:3600}}]);
  assert.deepEqual(staged.cookies.getAll(),[{name:'sb-test-auth-token',value:'new'}]);
  staged.cookies.setAll([{name:'sb-test-auth-token',value:'',options:{maxAge:0}}]);
  const response=staged.commit(NextResponse.json({ok:true}));
  assert.equal(response.cookies.getAll().length,1);
  assert.equal(response.cookies.get('sb-test-auth-token')?.maxAge,0);
  assert.equal(response.cookies.get('sb-test-auth-token')?.value,'');
});

test('production cookies enforce secure flags and preserve provider cache headers',()=>{
  const environment:Record<string,string|undefined>=process.env;
  const previous=environment.NODE_ENV;
  environment.NODE_ENV='production';
  try {
    const staged=stageSessionCookies([]);
    staged.cookies.setAll([{name:'sb-test-auth-token',value:'session',options:{httpOnly:false,secure:false,sameSite:'none',path:'/wrong'}}],{'Cache-Control':'public','Pragma':'no-cache','Expires':'0'});
    const response=staged.commit(NextResponse.json({ok:true}));
    const cookie=response.cookies.get('sb-test-auth-token');
    assert.equal(cookie?.httpOnly,true);
    assert.equal(cookie?.secure,true);
    assert.equal(cookie?.sameSite,'lax');
    assert.equal(cookie?.path,'/');
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal(response.headers.get('pragma'),'no-cache');
    assert.equal(response.headers.get('expires'),'0');
  } finally {
    if(previous===undefined) delete environment.NODE_ENV; else environment.NODE_ENV=previous;
  }
});
