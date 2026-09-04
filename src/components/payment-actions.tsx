'use client';
import Link from 'next/link';
import { useState,useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { financeAction } from './finance-actions';
export function PaymentActions({id,code,voided,issue,voidPayment}:{id:string;code:string|null;voided:boolean;issue:boolean;voidPayment:boolean}) {
 const router=useRouter();const[busy,setBusy]=useState(false);const[pending,startTransition]=useTransition();const[error,setError]=useState('');const[confirm,setConfirm]=useState(false);const[reason,setReason]=useState('');
 async function action(kind:'issue'|'void'){if(busy||pending)return;setBusy(true);setError('');try{const result=await financeAction(kind,{payment_id:id,...(kind==='void'?{reason}:{})});if(kind==='issue')router.push(`/panel/receipts/${result}`);else setConfirm(false);startTransition(()=>router.refresh());}catch(e){setError(e instanceof Error?e.message:'No fue posible completar la operación.');}finally{setBusy(false);}}
 return <section className="account-summary" aria-busy={busy||pending}><h2>Comprobante de pago</h2>
  {code?<Link prefetch={false} href={`/panel/receipts/${code}`}>Abrir recibo {code}</Link>:<p className="muted">{voided?'El pago está anulado.':'Este pago todavía no tiene un recibo emitido.'}</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="form-actions">{!code&&!voided&&issue&&<button disabled={busy||pending} className="action-primary" onClick={()=>void action('issue')}>{busy?'Emitiendo…':'Emitir recibo'}</button>}{!voided&&voidPayment&&<button disabled={busy||pending} className="action-secondary" onClick={()=>setConfirm(true)}>Anular pago</button>}</div>
  {confirm&&<form className="editor" onSubmit={e=>{e.preventDefault();void action('void');}}><h2>Confirmar anulación</h2><p className="muted">No se elimina el historial. Si hay un recibo, su verificación mostrará que fue anulado. Esta acción no se puede deshacer.</p><fieldset disabled={busy||pending}><label>Motivo *<textarea minLength={5} maxLength={500} required value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="form-actions"><button className="action-primary" type="submit">Confirmar anulación</button><button className="action-secondary" type="button" onClick={()=>setConfirm(false)}>Cancelar</button></div></fieldset></form>}
 </section>;
}
