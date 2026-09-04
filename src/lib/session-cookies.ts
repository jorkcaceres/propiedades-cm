import type { CookieOptions } from '@supabase/ssr';
import type { NextResponse } from 'next/server';

export const sessionCookieOptions = () => ({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'});

// Keep mutations local until the route explicitly authorizes their response.
export function stageSessionCookies(initial: {name:string;value:string}[]) {
  const current = new Map(initial.map(c => [c.name,c.value]));
  const pending = new Map<string,{value:string;options:CookieOptions}>();
  const responseHeaders = new Headers();
  return {
    cookies: {
      getAll: () => Array.from(current,([name,value])=>({name,value})),
      setAll(values:{name:string;value:string;options:CookieOptions}[],headers?:Record<string,string>) {
        for(const {name,value,options} of values) {
          current.set(name,value);pending.set(name,{value,options});
        }
        for(const [key,value] of Object.entries(headers||{})) responseHeaders.set(key,value);
      },
    },
    commit(response:NextResponse) {
      pending.forEach(({value,options},name)=>response.cookies.set(name,value,{...options,...sessionCookieOptions()}));
      responseHeaders.forEach((value,key)=>response.headers.set(key,value));
      response.headers.set('Cache-Control','private, no-store');
      return response;
    },
  };
}
