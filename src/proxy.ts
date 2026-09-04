import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authEnabled } from './lib/release';
export async function proxy(request:NextRequest) {
  let response=NextResponse.next({request});
  if(authEnabled() && (request.nextUrl.pathname==='/panel' || request.nextUrl.pathname.startsWith('/panel/'))){
    const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
      cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},
      cookies:{getAll:()=>request.cookies.getAll(),setAll(values,headers){
        values.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request});
        values.forEach(({name,value,options})=>response.cookies.set(name,value,{...options,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'}));
        Object.entries(headers||{}).forEach(([k,v])=>response.headers.set(k,v));
      }}
    });
    try {await client.auth.getClaims();} catch { /* The protected page fails closed via getUser + RLS. */ }
  }
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config={matcher:['/panel/:path*']};
