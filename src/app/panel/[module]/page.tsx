import { notFound } from 'next/navigation';
import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import { isModule,modules,type DataRecord } from '@/lib/modules';
import { pageRequest } from '@/lib/pagination';
import { Pagination } from '@/components/pagination';
import { Records } from '@/components/records';
import type { PropertyReference,StoredDocument } from '@/lib/assets';
export default async function ModulePage({params,searchParams}:{params:Promise<{module:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {module}=await params;if(!isModule(module))notFound();
  const {client,member}=await access();
  if(!can(member,`${module}.view`))return <section className="empty-state"><h1>Acceso restringido</h1><p>No tienes permiso para consultar este módulo.</p></section>;
  const search=await searchParams;const q=typeof search.q==='string'?search.q.slice(0,100):'';
  const {page,from,to}=pageRequest(search.page);
  const status=['all','inactive'].includes(String(search.status))?String(search.status):'active';
  let query=client.from(`pcm_${module}`).select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,to);
  if(q)query=query.ilike('name',`%${q.replace(/[\\%_]/g,'\\$&')}%`);
  if(status!=='all')query=query.eq('active',status==='active');
  const [result,owners]=await Promise.all([query,module==='properties'&&can(member,'landlords.view')?client.from('pcm_landlords').select('id,name,active').order('name').limit(1000):Promise.resolve({data:[],error:null})]);
  if(result.error||owners.error)throw Error('No fue posible cargar los registros.');
  const ids=(result.data||[]).map(item=>item.id);const referenceRights={view:can(member,'property_references.view'),create:can(member,'property_references.create'),edit:can(member,'property_references.edit'),delete:can(member,'property_references.delete')};const documentRights={view:can(member,'property_documents.view'),upload:can(member,'property_documents.upload'),edit:can(member,'property_documents.edit'),delete:can(member,'property_documents.delete')};
  const [references,documents]=module==='properties'&&ids.length?await Promise.all([
    referenceRights.view?client.from('pcm_property_references').select('id,property_id,identifier_type,identifier,company,version').in('property_id',ids).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),
    documentRights.view?client.from('pcm_property_documents').select('id,property_id,name,original_name,size_bytes,version,created_at').in('property_id',ids).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),
  ]):[{data:[],error:null},{data:[],error:null}];
  if(references.error||documents.error)throw Error('No fue posible cargar los datos asociados a las viviendas.');
  const count=result.count||0;
  return <><div className="page-heading"><h1>{modules[module].label}</h1><p className="muted">{modules[module].description}</p></div>
    <form className="list-filters" method="get"><label>Buscar por nombre<input name="q" defaultValue={q} maxLength={100}/></label><label>Estado<select name="status" defaultValue={status}><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select></label><button className="action-secondary" type="submit">Buscar</button></form>
    <p className="result-count">{count} registros · Más recientes primero</p>
    <Records key={module} module={module} records={(result.data||[]) as DataRecord[]} landlords={owners.data||[]} rights={{create:can(member,`${module}.create`),edit:can(member,`${module}.edit`),archive:can(member,`${module}.archive`)}} propertyAssets={module==='properties'?{references:(references.data||[]) as PropertyReference[],documents:(documents.data||[]) as StoredDocument[],referenceRights,documentRights}:undefined}/>
    <Pagination page={page} total={count} path={`/panel/${module}`} filters={{q,status}}/>
  </>;
}
