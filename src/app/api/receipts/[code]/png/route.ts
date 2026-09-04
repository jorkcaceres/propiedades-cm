import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { access } from '@/lib/access';
import { failure } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { receiptCode,type Receipt } from '@/lib/finance';
import { appUrl } from '@/lib/supabase';
import { renderReceiptV2 } from '@/lib/receipt-image';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{code:string}>}){
 try{const{client}=await access('receipts.download');await access('receipts.view');const{code}=await params;if(!receiptCode.safeParse(code).success)throw new HttpError('Recibo no encontrado.',404);
  const{data,error}=await client.from('pcm_receipts').select('*').eq('code',code).maybeSingle();if(error)throw new HttpError('No fue posible consultar el recibo.',503);if(!data)throw new HttpError('Recibo no encontrado.',404);
  const state=await client.rpc('pcm_verify_receipt',{receipt_code:code});if(state.error||!state.data)throw new HttpError('No fue posible verificar el estado del recibo.',503);
  const logo=await readFile(join(process.cwd(),'public/brand/logo-white.png'));
  const png=await renderReceiptV2(data as Receipt,state.data.voided,appUrl(),`data:image/png;base64,${logo.toString('base64')}`);
  // Consume the render here so a renderer failure returns controlled JSON, not a partial download.
  return new Response(await png.arrayBuffer(),{headers:png.headers});
 }catch(error){return failure(error);}
}
