import { pageRequest,type SearchValues } from '@/lib/pagination';
import { Pagination } from '@/components/pagination';
import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import { Leases,type LeaseRow } from '@/components/leases';
import type { StoredDocument } from '@/lib/assets';
export default async function LeasesPage({searchParams}:{searchParams:Promise<SearchValues>}){
 const {client,member}=await access();if(!can(member,'leases.view'))return <section className="empty-state"><h1>Acceso restringido</h1><p>No tienes permiso para consultar arrendamientos.</p></section>;
 const params=await searchParams;const {page,from,to}=pageRequest(params.page);const status=params.status==='inactive'?'inactive':params.status==='all'?'all':'active';
 const references=['properties.view','landlords.view','tenants.view'].every(p=>can(member,p));
 let query=client.from('pcm_leases').select('*,property:pcm_properties(name),tenant:pcm_tenants(name),landlord:pcm_landlords(name)',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,to);if(status!=='all')query=query.eq('active',status==='active');
 const [result,properties,tenants]=await Promise.all([query,references?client.from('pcm_properties').select('id,name,active').order('name').limit(1000):Promise.resolve({data:[],error:null}),references?client.from('pcm_tenants').select('id,name,active').order('name').limit(1000):Promise.resolve({data:[],error:null})]);
 if(result.error||properties.error||tenants.error)throw Error('No fue posible consultar los arrendamientos.');
 const documentRights={view:can(member,'lease_documents.view'),upload:can(member,'lease_documents.upload'),edit:can(member,'lease_documents.edit'),delete:can(member,'lease_documents.delete')};const leaseIds=(result.data||[]).map(row=>row.id);
 const documentResult=documentRights.view&&leaseIds.length?await client.from('pcm_lease_documents').select('id,lease_id,name,original_name,size_bytes,version,created_at').in('lease_id',leaseIds).order('created_at',{ascending:false}):{data:[],error:null};
 if(documentResult.error)throw Error('No fue posible consultar los documentos de los arrendamientos.');
 return <><div className="page-heading"><h1>Arrendamientos</h1><p className="muted">Cada vivienda, su titular y las condiciones para registrar pagos.</p></div><form className="list-filters"><label>Estado<select name="status" defaultValue={status}><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select></label><button className="action-secondary">Filtrar</button></form><p className="result-count">{result.count||0} registros · Página {page}</p>
  <Leases rows={(result.data||[]) as unknown as LeaseRow[]} properties={properties.data||[]} tenants={tenants.data||[]} rights={{create:can(member,'leases.create'),edit:can(member,'leases.edit'),archive:can(member,'leases.archive'),references}} documents={(documentResult.data||[]) as StoredDocument[]} documentRights={documentRights}/>
  <Pagination page={page} total={result.count||0} path="/panel/leases" filters={{status}}/>
 </>;
}
