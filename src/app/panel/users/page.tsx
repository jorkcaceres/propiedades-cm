import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import { Members,type MemberRecord } from '@/components/members';
import { pageRequest,type SearchValues } from '@/lib/pagination';
import { Pagination } from '@/components/pagination';
export default async function UsersPage({searchParams}:{searchParams:Promise<SearchValues>}) {
  const {client,member}=await access();
  if(!can(member,'users.view'))return <section className="empty-state"><h1>Acceso restringido</h1><p>No tienes permiso para consultar usuarios.</p></section>;
  const {page,from,to}=pageRequest((await searchParams).page);
  const {data,error,count}=await client.from('pcm_members').select('id,name,email,active,is_admin,permissions,updated_at',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,to);
  if(error)throw Error('No fue posible consultar los usuarios.');
  return <><div className="page-heading"><h1>Usuarios y permisos</h1><p className="muted">Controla quién puede ingresar y qué acciones puede realizar.</p></div><p className="result-count">{count||0} usuarios · Más recientes primero</p><Members members={(data||[]) as MemberRecord[]} actor={member}/><Pagination page={page} total={count||0} path="/panel/users"/></>;
}
