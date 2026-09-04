import 'server-only';
import { cache } from 'react';
import { db } from './supabase';
import { can, type Member } from './permissions';
import { authEnabled } from './release';
import { HttpError } from './errors';
export { HttpError } from './errors';
const currentAccess=cache(async()=>{
  if (!authEnabled()) throw new HttpError('El acceso aún no está habilitado.',503);
  const client=await db();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user||!user.email_confirmed_at||user.is_anonymous) throw new HttpError('Inicia sesión para continuar.',401);
  const {data:member,error:memberError}=await client.from('pcm_members').select('id,name,email,active,is_admin,permissions').eq('id',user.id).maybeSingle();
  if(memberError) throw new HttpError('No fue posible verificar el acceso. Intenta nuevamente.',503);
  if(!member?.active) throw new HttpError('Tu cuenta no tiene acceso activo. Contacta al administrador.',403);
  return {client,user,member:member as Member};
});
export async function access(permission?:string) {
  const result=await currentAccess();
  if(permission&&!can(result.member,permission)) throw new HttpError('No tienes permiso para realizar esta acción.',403);
  return result;
}
