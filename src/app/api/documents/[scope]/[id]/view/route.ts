import { NextResponse } from 'next/server';
import { access } from '@/lib/access';
import { HttpError } from '@/lib/errors';
import { failure } from '@/lib/http';
import { privilegedDb } from '@/lib/supabase';
import { DOCUMENT_BUCKET,documentConfig,isDocumentScope } from '@/lib/assets';

type Context={params:Promise<{scope:string;id:string}>};
export async function GET(_:Request,context:Context){
  try{
    const {scope,id}=await context.params;if(!isDocumentScope(scope))throw new HttpError('Tipo de documento no válido.',404);
    const config=documentConfig(scope);const {client}=await access(`${config.permission}.view`);
    const {data,error}=await client.from(config.table).select('storage_path').eq('id',id).maybeSingle();
    if(error||!data)throw new HttpError('El documento no está disponible.',404);
    const signed=await privilegedDb().storage.from(DOCUMENT_BUCKET).createSignedUrl(data.storage_path,60);
    if(signed.error||!signed.data?.signedUrl)throw new HttpError('No fue posible abrir el documento.',503);
    return NextResponse.redirect(signed.data.signedUrl,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return failure(error);}
}
