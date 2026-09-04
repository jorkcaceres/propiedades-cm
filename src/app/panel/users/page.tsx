import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import { Members,type MemberRecord } from '@/components/members';
export default async function UsersPage() {
  const {client,member}=await access();
  if(!can(member,'users.view'))return <section className="empty-state"><h1>Acceso restringido</h1><p>No tienes permiso para consultar usuarios.</p></section>;
  const {data,error}=await client.from('pcm_members').select('id,name,email,active,is_admin,permissions,updated_at').order('name').limit(1000);
  if(error)throw Error('No fue posible consultar los usuarios.');
  return <><div className="page-heading"><h1>Usuarios y permisos</h1><p className="muted">Controla quién puede ingresar y qué acciones puede realizar.</p></div><Members members={(data||[]) as MemberRecord[]} actor={member}/></>;
}
