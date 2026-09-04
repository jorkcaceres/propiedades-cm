import { notFound } from 'next/navigation';
import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import { isModule,modules,type DataRecord } from '@/lib/modules';
import { pageRequest } from '@/lib/pagination';
import { Pagination } from '@/components/pagination';
import { Records } from '@/components/records';
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
  const count=result.count||0;
  return <><div className="page-heading"><h1>{modules[module].label}</h1><p className="muted">{modules[module].description}</p></div>
    <form className="list-filters" method="get"><label>Buscar por nombre<input name="q" defaultValue={q} maxLength={100}/></label><label>Estado<select name="status" defaultValue={status}><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select></label><button className="action-secondary" type="submit">Buscar</button></form>
    <p className="result-count">{count} registros · Más recientes primero</p>
    <Records key={module} module={module} records={(result.data||[]) as DataRecord[]} landlords={owners.data||[]} rights={{create:can(member,`${module}.create`),edit:can(member,`${module}.edit`),archive:can(member,`${module}.archive`)}}/>
    <Pagination page={page} total={count} path={`/panel/${module}`} filters={{q,status}}/>
  </>;
}
