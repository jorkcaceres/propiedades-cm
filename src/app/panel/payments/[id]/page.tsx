import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { access } from '@/lib/access';
import { can } from '@/lib/permissions';
import type { Payment } from '@/lib/finance';
import { ReceiptDetails } from '@/components/receipt-details';
import { PaymentActions } from '@/components/payment-actions';
export default async function PaymentPage({params}:{params:Promise<{id:string}>}){
 const {client,member}=await access();if(!can(member,'payments.view'))return <section className="empty-state"><h1>Acceso restringido</h1></section>;
 const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();
 const {data,error}=await client.from('pcm_payments').select('*').eq('id',id).maybeSingle();if(error)throw Error('No fue posible consultar el pago.');if(!data)notFound();const payment=data as Payment;
 const receipt=can(member,'receipts.view')?await client.from('pcm_receipts').select('code').eq('payment_id',id).maybeSingle():{data:null,error:null};if(receipt.error)throw Error('No fue posible consultar el recibo.');
 return <><Link href="/panel/payments" prefetch={false}>Volver a pagos</Link><div className="page-heading finance-heading"><h1>Detalle del pago</h1><p className={payment.voided_at?'error':'success-note'}>{payment.voided_at?'Pago anulado':'Pago registrado'}{payment.void_reason?` · ${payment.void_reason}`:''}</p></div><ReceiptDetails snapshot={payment.snapshot}/>{payment.notes&&<div className="notice"><strong>Nota interna</strong>{payment.notes}</div>}
  <PaymentActions id={id} code={receipt.data?.code||null} voided={!!payment.voided_at} issue={can(member,'receipts.issue')&&can(member,'receipts.view')} voidPayment={can(member,'payments.void')}/>
 </>;
}
