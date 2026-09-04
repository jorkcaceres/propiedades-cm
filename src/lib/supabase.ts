import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { sessionCookieOptions, stageSessionCookies } from './session-cookies';
export function configured() { return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); }
export async function db() {
  if(!configured()) throw new Error('Falta configurar la conexión de la plataforma.');
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookieOptions: sessionCookieOptions(),
    cookies:{getAll:()=>jar.getAll(),setAll(values){try {values.forEach(({name,value,options})=>jar.set(name,value,{...options,...sessionCookieOptions()}));} catch { /* Proxy owns refresh in Server Components. */ }}},
  });
}

// Route handlers stage session cookies. Only successful, authorized logins commit them.
export async function routeDb() {
  if (!configured()) throw new Error('Falta configurar la conexión de la plataforma.');
  const jar = await cookies();
  const staged = stageSessionCookies(jar.getAll());
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookieOptions: sessionCookieOptions(),
    cookies: staged.cookies,
  });
  return {client,commit:staged.commit};
}
export function privilegedDb() {
  if(!process.env.SUPABASE_SECRET_KEY) throw new Error('Falta configurar la operación segura del servidor.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function appUrl() { const url=new URL(process.env.APP_URL || 'https://propiedadescm.jorkcaceres.com'); return url.origin; }
