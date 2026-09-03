import 'server-only';
import { db } from './supabase';
import { can, type Member } from './permissions';
import { AUTH_READY } from './release';
export class HttpError extends Error { constructor(message:string,public status=400){super(message);} }
export async function access(permission?:string) {
  if (!AUTH_READY) throw new HttpError('El acceso aún no está habilitado.',503);
  const client=await db();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user) throw new HttpError('Inicia sesión para continuar.',401);
  const {data:member,error:memberError}=await client.from('pcm_members').select('*').eq('id',user.id).maybeSingle();
  if(memberError||!member?.active) throw new HttpError('Tu cuenta no tiene acceso activo. Contacta al administrador.',403);
  if(permission&&!can(member as Member,permission)) throw new HttpError('No tienes permiso para realizar esta acción.',403);
  return {client,user,member:member as Member};
}
