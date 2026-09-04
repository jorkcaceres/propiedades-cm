import Link from 'next/link';
import { pageRequest,type SearchValues } from '@/lib/pagination';
import { Pagination } from '@/components/pagination';
import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import { cop,displayDate,concepts,type Payment } from '@/lib/finance';
import { PaymentForm } from '@/components/payment-form';
import type { LeaseRow } from '@/components/leases';
export default async function PaymentsPage({searchParams}:{searchParams:Promise<SearchValues>}) {
 const {client,member}=await access();if(!can(member,'payments.view'))return <section className="empty-state"><h1>Acceso restringido</h1><p>No tienes permiso para consultar pagos.</p></section>;
 const params=await searchParams;const {page,from,to}=pageRequest(params.page);const concept=typeof params.concept==='string'&&Object.hasOwn(concepts,params.concept)?params.concept:'all';const status=params.status==='void'?'void':params.status==='all'?'all':'valid';
 let query=client.from('pcm_payments').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,to);if(concept!=='all')query=query.eq('concept',concept);if(status==='valid')query=query.is('voided_at',null);if(status==='void')query=query.not('voided_at','is',null);
 const create=['payments.create','leases.view','properties.view','tenants.view'].every(p=>can(member,p));
 const [result,leases,payers]=await Promise.all([query,create?client.from('pcm_leases').select('*,property:pcm_properties(name),tenant:pcm_tenants(name),landlord:pcm_landlords(name)').eq('active',true).order('created_at',{ascending:false}).limit(1000):Promise.resolve({data:[],error:null}),create?client.from('pcm_tenants').select('id,name,active').order('name').limit(1000):Promise.resolve({data:[],error:null})]);
 if(result.error||leases.error||payers.error)throw Error('No fue posible consultar pagos.');
 return <><div className="page-heading"><h1>Pagos</h1><p className="muted">Dinero recibido, historial y emisión de comprobantes.</p></div>
  {create?<PaymentForm leases={(leases.data||[]) as unknown as LeaseRow[]} payers={payers.data||[]}/>:can(member,'payments.create')&&<p className="notice">Para registrar pagos necesitas consultar arrendamientos, viviendas y arrendatarios.</p>}
  <form className="list-filters finance-filters"><label>Concepto<select name="concept" defaultValue={concept}><option value="all">Todos</option>{Object.entries(concepts).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Estado<select name="status" defaultValue={status}><option value="valid">Vigentes</option><option value="void">Anulados</option><option value="all">Todos</option></select></label><button className="action-secondary">Filtrar</button></form><p className="result-count">{result.count||0} registros · Página {page}</p>
  <div className="record-list">{!result.data?.length&&<p className="empty-state">No hay pagos en esta lista. Crea primero un arrendamiento y registra un ingreso real.</p>}{((result.data||[]) as Payment[]).map(p=><article className="record-card" key={p.id}><div className="record-title"><h2>{p.snapshot.property_name}</h2><span className="status-tag">{p.voided_at?'Anulado':'Registrado'}</span></div><p className="finance-amount">{cop(p.amount)}</p><p>{concepts[p.concept]} · {displayDate(p.paid_on)}</p><p className="muted">{p.payer_name}</p><Link className="action-secondary finance-link" prefetch={false} href={`/panel/payments/${p.id}`}>Ver pago y recibo</Link></article>)}</div>
  <Pagination page={page} total={result.count||0} path="/panel/payments" filters={{concept,status}}/>
 </>;
}
