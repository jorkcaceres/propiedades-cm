import { NextResponse } from 'next/server';
import { HttpError } from './errors';
import { appUrl } from './supabase';
import { ZodError } from 'zod';
export function sameOrigin(request:Request) {
  if(request.headers.get('origin')!==appUrl()) throw new HttpError('Origen de solicitud no permitido.',403);
}
export async function body(request:Request) {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError('Formato de solicitud no válido.');
  const reader=request.body?.getReader();
  if(!reader) throw new HttpError('Solicitud no válida.');
  const decoder=new TextDecoder(); let raw=''; let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read(); if(done) break;
      size+=value.byteLength;
      if(size>32000) { await reader.cancel(); throw new HttpError('La solicitud es demasiado grande.',413); }
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
  } finally {reader.releaseLock();}
  try {return JSON.parse(raw);} catch {throw new HttpError('Solicitud no válida.');}
}
export function failure(error:unknown) {
  const headers={'Cache-Control':'private, no-store'};
  if(error instanceof HttpError) return NextResponse.json({error:error.message},{status:error.status,headers});
  if(error instanceof ZodError) return NextResponse.json({error:'Revisa el correo, la contraseña y la verificación de seguridad.'},{status:400,headers});
  console.error('PCM operation failed',error instanceof Error?error.name:'unknown');
  return NextResponse.json({error:'No fue posible completar la operación. Intenta nuevamente.'},{status:500,headers});
}
