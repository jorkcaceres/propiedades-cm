import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { access } from '@/lib/access';
import { databaseError } from '@/lib/database-errors';
import { HttpError } from '@/lib/errors';
import { body,failure,sameOrigin } from '@/lib/http';
import { privilegedDb } from '@/lib/supabase';
import { DOCUMENT_BUCKET,MAX_DOCUMENT_BYTES,documentConfig,documentMutation,documentName,isDocumentScope,isPdf,safePdfName } from '@/lib/assets';

type Context={params:Promise<{scope:string}>};
const headers={'Cache-Control':'private, no-store'};
async function cleanPending(){
  const admin=privilegedDb();const {data}=await admin.from('pcm_storage_cleanup_queue').select('storage_path,attempts').order('created_at').limit(10);
  if(!data?.length)return;
  for(const item of data){
    const removed=await admin.storage.from(DOCUMENT_BUCKET).remove([item.storage_path]);
    if(removed.error)await admin.from('pcm_storage_cleanup_queue').update({attempts:item.attempts+1,last_attempt_at:new Date().toISOString()}).eq('storage_path',item.storage_path);
    else await admin.from('pcm_storage_cleanup_queue').delete().eq('storage_path',item.storage_path);
  }
}
async function parsedForm(request:Request){
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))throw new HttpError('Formato de archivo no válido.');
  const length=Number(request.headers.get('content-length')||0);if(length>MAX_DOCUMENT_BYTES+100_000)throw new HttpError('El documento supera el límite de 20 MB.',413);
  const form=await request.formData();const file=form.get('file');const entityId=String(form.get('entity_id')||'');const name=documentName.parse(form.get('name'));
  if(!(file instanceof File)||!entityId)throw new HttpError('Selecciona un archivo PDF.');
  if(file.size<1||file.size>MAX_DOCUMENT_BYTES)throw new HttpError('El documento debe pesar máximo 20 MB.',413);
  const bytes=new Uint8Array(await file.arrayBuffer());if(file.type!=='application/pdf'||!isPdf(bytes))throw new HttpError('El archivo debe ser un PDF válido.');
  return {file,bytes,entityId,name,documentId:String(form.get('document_id')||''),version:Number(form.get('version')||0)};
}
export async function POST(request:Request,context:Context){
  let uploadedPath='';
  try{
    sameOrigin(request);const {scope}=await context.params;if(!isDocumentScope(scope))throw new HttpError('Tipo de documento no válido.',404);
    const config=documentConfig(scope);const form=await parsedForm(request);const replacing=!!form.documentId;
    const {client,user}=await access(`${config.permission}.${replacing?'edit':'upload'}`);
    await cleanPending();
    const {data:parent,error:parentError}=await client.from(config.parentTable).select('id').eq('id',form.entityId).maybeSingle();
    if(parentError)databaseError(parentError);if(!parent)throw new HttpError('El registro relacionado no está disponible.',404);
    let previous:{id:string;storage_path:string;version:number}|null=null;
    if(replacing){
      const {data,error}=await client.from(config.table).select('id,storage_path,version').eq('id',form.documentId).eq(config.entityColumn,form.entityId).maybeSingle();
      if(error)databaseError(error);if(!data||data.version!==form.version)throw new HttpError('El documento cambió. Actualiza antes de reemplazarlo.',409);previous=data;
    }
    uploadedPath=`${config.folder}/${form.entityId}/${randomUUID()}.pdf`;
    const storage=privilegedDb().storage.from(DOCUMENT_BUCKET);
    const upload=await storage.upload(uploadedPath,form.bytes,{contentType:'application/pdf',upsert:false,cacheControl:'3600'});
    if(upload.error)throw new HttpError('No fue posible almacenar el documento.',503);
    const values={name:form.name,storage_path:uploadedPath,original_name:safePdfName(form.file.name),mime_type:'application/pdf',size_bytes:form.file.size,updated_by:user.id};
    if(previous){
      const {data,error}=await privilegedDb().from(config.table).update(values).eq('id',previous.id).eq('version',previous.version).select('id').maybeSingle();
      if(error)databaseError(error);if(!data)throw new HttpError('El documento cambió. Actualiza antes de reemplazarlo.',409);
      uploadedPath='';
      const removed=await storage.remove([previous.storage_path]);
      if(removed.error)await privilegedDb().from('pcm_storage_cleanup_queue').upsert({storage_path:previous.storage_path,last_attempt_at:new Date().toISOString()});
      return NextResponse.json({id:data.id,replaced:true},{headers});
    }
    const {data,error}=await privilegedDb().from(config.table).insert({...values,[config.entityColumn]:form.entityId,created_by:user.id}).select('id').single();
    if(error)databaseError(error);uploadedPath='';return NextResponse.json({id:data!.id},{status:201,headers});
  }catch(error){
    if(uploadedPath)await privilegedDb().storage.from(DOCUMENT_BUCKET).remove([uploadedPath]);
    return failure(error);
  }
}

export async function PATCH(request:Request,context:Context){
  try{
    sameOrigin(request);const {scope}=await context.params;if(!isDocumentScope(scope))throw new HttpError('Tipo de documento no válido.',404);
    const config=documentConfig(scope);const payload=documentMutation.parse(await body(request));
    const {client,user}=await access(`${config.permission}.${payload.action==='rename'?'edit':'delete'}`);await cleanPending();
    if(payload.action==='rename'){
      const {data,error}=await privilegedDb().from(config.table).update({name:payload.name,updated_by:user.id}).eq('id',payload.id).eq('version',payload.version).select('id').maybeSingle();
      if(error)databaseError(error);if(!data)throw new HttpError('El documento cambió o ya no está disponible.',409);
      return NextResponse.json({ok:true},{headers});
    }
    const {data:document,error:findError}=await client.from(config.table).select('id,storage_path,version').eq('id',payload.id).maybeSingle();
    if(findError)databaseError(findError);if(!document||document.version!==payload.version)throw new HttpError('El documento cambió o ya no está disponible.',409);
    const removed=await privilegedDb().storage.from(DOCUMENT_BUCKET).remove([document.storage_path]);
    if(removed.error)throw new HttpError('No fue posible eliminar el archivo almacenado. Intenta nuevamente.',503);
    const {data,error}=await privilegedDb().from(config.table).delete().eq('id',payload.id).eq('version',payload.version).select('id').maybeSingle();
    if(error)databaseError(error);
    if(!data){
      throw new HttpError('El archivo se eliminó, pero no fue posible completar la limpieza del registro.',503);
    }
    return NextResponse.json({ok:true},{headers});
  }catch(error){return failure(error);}
}
