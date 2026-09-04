import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { HttpError } from './errors';

export const loginInput = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(128),
  turnstileToken: z.string().trim().min(1).max(2048),
}).strict();

export async function authenticate(client: SupabaseClient, input: unknown) {
  const credentials = loginInput.parse(input);
  const {data,error} = await client.auth.signInWithPassword({
    email: credentials.email, password: credentials.password,
    options: { captchaToken: credentials.turnstileToken },
  });
  if (error) {
    if (error.code === 'captcha_failed') throw new HttpError('Completa nuevamente la verificación de seguridad.',403);
    if (error.status === 429) throw new HttpError('Demasiados intentos. Espera unos minutos y vuelve a intentar.',429);
    if (error.status && error.status >= 500) throw new HttpError('El acceso no está disponible temporalmente. Intenta más tarde.',503);
    throw new HttpError('No fue posible ingresar. Revisa tus credenciales o contacta al administrador.',401);
  }
  try {
    if (!data.session || !data.user?.email_confirmed_at || data.user.is_anonymous) {
      throw new HttpError('Esta cuenta no tiene acceso autorizado.',403);
    }
    // RLS checks active membership AND the server-side Supabase session record.
    const {data:member,error:memberError} = await client.from('pcm_members')
      .select('id,active').eq('id',data.user.id).maybeSingle();
    if (memberError) throw new HttpError('No fue posible verificar los permisos. Intenta nuevamente.',503);
    if (!member?.active || member.id !== data.user.id) throw new HttpError('Esta cuenta no tiene acceso autorizado.',403);
  } catch (error) {
    // Revoke a successful Auth session that failed application authorization.
    // The route also discards every staged cookie on this failure path.
    try { await client.auth.signOut({scope:'local'}); } catch { /* No cookies will be sent. */ }
    throw error;
  }
}
