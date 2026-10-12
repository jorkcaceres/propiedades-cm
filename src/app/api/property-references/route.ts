import { NextResponse } from 'next/server';
import { access } from '@/lib/access';
import { body,failure,sameOrigin } from '@/lib/http';
import { databaseError } from '@/lib/database-errors';
import { HttpError } from '@/lib/errors';
import { referenceInput,referenceMutation } from '@/lib/assets';

const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
  try{
    sameOrigin(request);const values=referenceInput.parse(await body(request));
    const {client,user}=await access('property_references.create');
    const {data:parent,error:parentError}=await client.from('pcm_properties').select('id').eq('id',values.property_id).maybeSingle();
    if(parentError)databaseError(parentError);if(!parent)throw new HttpError('La vivienda no está disponible.',404);
    const {data,error}=await client.from('pcm_property_references').insert({...values,created_by:user.id,updated_by:user.id}).select('id').single();
    if(error)databaseError(error);return NextResponse.json({id:data!.id},{status:201,headers});
  }catch(error){return failure(error);}
}
export async function PATCH(request:Request){
  try{
    sameOrigin(request);const payload=referenceMutation.parse(await body(request));
    const {client}=await access(`property_references.${payload.action}`);
    if(payload.action==='edit'){
      const {data,error}=await client.from('pcm_property_references').update(payload.values).eq('id',payload.id).eq('version',payload.version).select('id').maybeSingle();
      if(error)databaseError(error);if(!data)throw new HttpError('La referencia cambió o ya no está disponible.',409);
    }else{
      const {data,error}=await client.from('pcm_property_references').delete().eq('id',payload.id).eq('version',payload.version).select('id').maybeSingle();
      if(error)databaseError(error);if(!data)throw new HttpError('La referencia cambió o ya no está disponible.',409);
    }
    return NextResponse.json({ok:true},{headers});
  }catch(error){return failure(error);}
}
