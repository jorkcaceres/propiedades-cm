import Link from 'next/link';
import { notFound } from 'next/navigation';
import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import { receiptCode,type Receipt } from '@/lib/finance';
import { ReceiptDetails } from '@/components/receipt-details';
import { ReceiptDownload } from '@/components/receipt-download';
export default async function ReceiptPage({params}:{params:Promise<{code:string}>}) {
 const{client,member}=await access();if(!can(member,'receipts.view'))return <section className="empty-state"><h1>Acceso restringido</h1></section>;
 const{code}=await params;if(!receiptCode.safeParse(code).success)notFound();const{data,error}=await client.from('pcm_receipts').select('*').eq('code',code).maybeSingle();if(error)throw Error('No fue posible consultar el recibo.');if(!data)notFound();const receipt=data as Receipt;
 const state=await client.rpc('pcm_verify_receipt',{receipt_code:code});if(state.error||!state.data)throw Error('No fue posible verificar el estado del recibo.');
 return <><Link prefetch={false} href="/panel/receipts">Volver a recibos</Link><div className="page-heading finance-heading"><h1>Recibo de pago</h1><p className="receipt-code">{code}</p><p className={state.data.voided?'error':'success-note'}>{state.data.voided?'ANULADO · No utilizar como comprobante vigente.':'Recibo vigente en el registro de Propiedades CM.'}</p></div><ReceiptDetails snapshot={receipt.snapshot}/><div className="form-actions">{can(member,'receipts.download')&&<ReceiptDownload code={code}/>}<Link className="action-secondary" prefetch={false} href={`/verificar/${code}`}>Verificación pública</Link>{can(member,'payments.view')&&<Link className="action-secondary" prefetch={false} href={`/panel/payments/${receipt.payment_id}`}>Ver pago original</Link>}</div><p className="notice">El PNG conserva los datos de la emisión. Su QR permite comprobar código, valor, fecha, concepto, periodo y estado actual. La consulta pública no muestra nombres ni dirección. Comparte el archivo únicamente con las personas correspondientes.</p></>;
}
