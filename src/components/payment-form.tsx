'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { concepts,methods,cop,bogotaToday,type Choice } from '@/lib/finance';
import type { LeaseRow } from './leases';
import { financeAction,FinanceError } from './finance-actions';
import { paymentPeriod,nextMonth } from '@/lib/payment-months';
export function PaymentForm({leases,payers}:{leases:LeaseRow[];payers:Choice[]}) {
 const router=useRouter();const[open,setOpen]=useState(false);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[leaseId,setLeaseId]=useState('');const[amount,setAmount]=useState('');const[payer,setPayer]=useState('');const[concept,setConcept]=useState<keyof typeof concepts>('rent');const[requestId,setRequestId]=useState('');const[submitted,setSubmitted]=useState<Record<string,unknown>|null>(null);
 const[months,setMonths]=useState<string[]>(['']);
 function begin(){setOpen(true);setRequestId(crypto.randomUUID());setSubmitted(null);setError('');}
 function choose(id:string){setLeaseId(id);setMonths(['']);const lease=leases.find(l=>l.id===id);setAmount(String(lease?.monthly_rent||''));setPayer(lease?.tenant?.name||'');}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setError('');
  let payload=submitted;
  if(!payload){
   try{const data=new FormData(event.currentTarget);payload={request_id:requestId,lease_id:leaseId,amount:Number(amount),payer_name:payer,concept,paid_on:data.get('paid_on'),...paymentPeriod(concept,months,leases.find(l=>l.id===leaseId)),method:data.get('method'),reference:data.get('reference'),notes:data.get('notes')};}
   catch(e){setError(e instanceof Error?e.message:'Revisa los meses seleccionados.');return;}
  }
  setSubmitted(payload);setBusy(true);
  try{const id=await financeAction('payments',payload);router.push(`/panel/payments/${id}`);router.refresh();}
  catch(e){setError(e instanceof Error?e.message:'No fue posible guardar.');if(e instanceof FinanceError&&[400,403,409].includes(e.status)&&!e.message.includes('otros datos'))setSubmitted(null);setBusy(false);}
 }
 if(!open)return <button className="action-primary" onClick={begin}>Registrar pago recibido</button>;
 const selected=leases.find(l=>l.id===leaseId);
 return <form className="editor" onSubmit={submit} aria-busy={busy}><h2>Registrar dinero recibido</h2><p className="muted">Confirma primero el ingreso en tu cuenta. Un soporte enviado por el pagador no confirma por sí solo que recibiste el dinero.</p>
  {error&&<div className="error" role="alert"><p>{error}</p><p className="small">{submitted?'Puedes reintentar con los mismos datos sin duplicar el pago. Antes de comenzar otro registro, revisa el historial.':'Revisa los datos y vuelve a guardar.'}</p></div>}
  <fieldset disabled={busy||!!submitted}><div className="form-grid">
   <label>Arrendamiento activo *<select required value={leaseId} onChange={e=>choose(e.target.value)}><option value="">Seleccionar arrendamiento</option>{leases.map(l=><option key={l.id} value={l.id}>{l.property?.name||l.id} · {l.tenant?.name||'Titular'}</option>)}</select></label>
   <label>Concepto *<select value={concept} onChange={e=>setConcept(e.target.value as keyof typeof concepts)}>{Object.entries(concepts).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Valor recibido (COP, sin puntos) *<input type="number" inputMode="numeric" min={1} max={999999999} step={1} required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <label>Fecha del pago *<input name="paid_on" type="date" required defaultValue={bogotaToday()} max={bogotaToday()}/></label>
   {concept!=='deposit'&&<fieldset className="payment-months" aria-describedby="payment-months-help"><legend>Mes(es) que paga *</legend>
    <div className="payment-month-list">{months.map((month,index)=><div className="payment-month-row" key={index}><label>Mes {index+1}<input type="month" required min={selected?.start_date.slice(0,7)} max={selected?.end_date?.slice(0,7)} value={month} onChange={e=>setMonths(months.map((value,i)=>i===index?e.target.value:value))}/></label>{months.length>1&&<button type="button" className="action-secondary" aria-label={`Quitar mes ${index+1}`} onClick={()=>setMonths(months.filter((_,i)=>i!==index))}>Quitar</button>}</div>)}</div>
    <button type="button" className="action-secondary" onClick={()=>{const next=nextMonth(months.at(-1)||'');setMonths([...months,selected?.end_date&&next>selected.end_date.slice(0,7)?'':next]);}}>Añadir otro mes</button>
    <p id="payment-months-help" className="small muted">Selecciona uno o varios meses consecutivos. El valor recibido no se modifica al añadir meses.</p>
   </fieldset>}
   <label>Nombre del pagador *<input list="payer-names" required minLength={2} maxLength={150} value={payer} onChange={e=>setPayer(e.target.value)}/><datalist id="payer-names">{payers.map(p=><option key={p.id} value={p.name}/>)}</datalist></label>
   <label>Medio de pago *<select name="method" defaultValue="transfer">{Object.entries(methods).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Referencia de la transferencia<input name="reference" maxLength={120}/></label><label>Nota interna (no aparece en el recibo)<textarea name="notes" maxLength={500}/></label>
  </div><p className="notice">El recibo acreditará únicamente el valor recibido ({cop(Number(amount)||0)}). No declara paz y salvo ni calcula automáticamente el saldo pendiente. El nombre del pagador queda en este pago, sin crear otra persona.</p><label className="permission-toggle"><input type="checkbox" required/>Confirmo que recibí este dinero y revisé los datos.</label></fieldset>
  <div className="form-actions"><button disabled={busy} className="action-primary" type="submit">{busy?'Guardando…':submitted?'Reintentar el mismo pago':'Guardar pago'}</button><button disabled={busy} className="action-secondary" type="button" onClick={()=>{setOpen(false);router.refresh();}}>Volver al historial</button></div>
 </form>;
}
