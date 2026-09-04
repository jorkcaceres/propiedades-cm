import { NextResponse } from 'next/server';
import { access } from '@/lib/access';
import { body,failure,sameOrigin } from '@/lib/http';
import { databaseError } from '@/lib/database-errors';
import { HttpError } from '@/lib/errors';
import { leaseInput,paymentInput,receiptInput,voidInput } from '@/lib/finance';
export async function POST(request:Request,{params}:{params:Promise<{operation:string}>}) {
 try {
  sameOrigin(request);const {operation}=await params;
  if(!['leases','payments','issue','void'].includes(operation))throw new HttpError('Operación no encontrada.',404);
  const {client}=await access();const raw=await body(request);
  let result;
  if(operation==='leases'){const payload=leaseInput.parse(raw);await access(`leases.${payload.action}`);result=await client.rpc('pcm_save_lease',{payload});}
  else if(operation==='payments'){await access('payments.create');result=await client.rpc('pcm_record_payment',{payload:paymentInput.parse(raw)});}
  else if(operation==='issue'){await access('receipts.issue');result=await client.rpc('pcm_issue_receipt',{target_payment:receiptInput.parse(raw).payment_id});}
  else {await access('payments.void');const value=voidInput.parse(raw);result=await client.rpc('pcm_void_payment',{target_payment:value.payment_id,reason:value.reason});}
  if(result.error)databaseError(result.error);
  return NextResponse.json({result:result.data},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return failure(error);}
}
