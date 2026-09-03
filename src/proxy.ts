import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_READY } from './lib/release';
export async function proxy(request:NextRequest) {
  let response=NextResponse.next({request});
  if(AUTH_READY&&process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY){
    const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{
      cookies:{getAll:()=>request.cookies.getAll(),setAll(values,headers){
        values.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request});
        values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
        Object.entries(headers||{}).forEach(([k,v])=>response.headers.set(k,v));
      }}
    });
    await client.auth.getClaims();
  }
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|logo.png|favicon.ico).*)']};
