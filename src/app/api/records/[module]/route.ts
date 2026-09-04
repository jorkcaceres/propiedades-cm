import { NextResponse } from 'next/server';
import { access } from '@/lib/access';
import { body,failure,sameOrigin } from '@/lib/http';
import { isModule,recordInput,recordMutation } from '@/lib/modules';
import { HttpError } from '@/lib/errors';
import { databaseError } from '@/lib/database-errors';
type Context={params:Promise<{module:string}>};
export async function POST(request:Request,context:Context) {
  try {
    sameOrigin(request);const {module}=await context.params;
    if(!isModule(module)) throw new HttpError('Módulo no encontrado.',404);
    const {client}=await access(`${module}.create`);
    const values=recordInput(module,await body(request));
    const {data,error}=await client.from(`pcm_${module}`).insert<typeof values>(values).select('id').single();
    if(error) databaseError(error);
    return NextResponse.json({id:data!.id},{status:201,headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return failure(error);}
}
export async function PATCH(request:Request,context:Context) {
  try {
    sameOrigin(request);const {module}=await context.params;
    if(!isModule(module)) throw new HttpError('Módulo no encontrado.',404);
    const payload=recordMutation.parse(await body(request));
    const {client}=await access(`${module}.${payload.action}`);
    const values=payload.action==='edit'?recordInput(module,payload.values):{active:payload.active};
    const {data,error}=await client.from(`pcm_${module}`).update(values).eq('id',payload.id).eq('version',payload.version).select('id').maybeSingle();
    if(error) databaseError(error);
    if(!data) throw new HttpError('El registro cambió o ya no está disponible. Actualiza antes de guardar.',409);
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {return failure(error);}
}
