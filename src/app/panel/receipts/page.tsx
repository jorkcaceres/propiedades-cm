import Link from 'next/link';
import { pageRequest,type SearchValues } from '@/lib/pagination';
import { Pagination } from '@/components/pagination';
import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import { cop,displayDate,type Receipt } from '@/lib/finance';
export default async function ReceiptsPage({searchParams}:{searchParams:Promise<SearchValues>}) {
 const{client,member}=await access();if(!can(member,'receipts.view'))return <section className="empty-state"><h1>Acceso restringido</h1></section>;
 const params=await searchParams;const {page,from,to}=pageRequest(params.page);const{data,error,count}=await client.from('pcm_receipts').select('*',{count:'exact'}).order('issued_at',{ascending:false}).order('id',{ascending:false}).range(from,to);if(error)throw Error('No fue posible consultar recibos.');
 return <><div className="page-heading"><h1>Recibos</h1><p className="muted">Comprobantes emitidos. Abre cada recibo para consultar su estado actual y descargarlo.</p></div>{can(member,'payments.view')&&<Link className="action-secondary" href="/panel/payments" prefetch={false}>Ir a pagos para emitir un recibo</Link>}<p className="result-count">{count||0} recibos · Más recientes primero</p><div className="record-list">{!data?.length&&<p className="empty-state">No hay recibos en esta página.</p>}{((data||[]) as Receipt[]).map(r=><article className="record-card" key={r.id}><h2>{r.snapshot.property_name}</h2><p className="finance-amount">{cop(r.snapshot.amount)}</p><p>{r.snapshot.payer_name} · {displayDate(r.snapshot.paid_on)}</p><p className="receipt-code">{r.code}</p><Link className="action-secondary finance-link" href={`/panel/receipts/${r.code}`} prefetch={false}>Ver recibo y estado</Link></article>)}</div><Pagination page={page} total={count||0} path="/panel/receipts"/></>;
}
