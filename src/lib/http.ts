import { NextResponse } from 'next/server';
import { HttpError } from './access';
import { appUrl } from './supabase';
import { ZodError } from 'zod';
export function sameOrigin(request:Request) {
  if(request.headers.get('origin')!==appUrl()) throw new HttpError('Origen de solicitud no permitido.',403);
}
export async function body(request:Request) {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError('Formato de solicitud no válido.');
  const raw=await request.text(); if(raw.length>32000) throw new HttpError('La solicitud es demasiado grande.',413);
  try {return JSON.parse(raw);} catch {throw new HttpError('Solicitud no válida.');}
}
export function failure(error:unknown) {
  if(error instanceof HttpError) return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof ZodError) return NextResponse.json({error:error.issues[0]?.message||'Revisa los campos.'},{status:400});
  console.error('PCM operation failed',error instanceof Error?error.name:'unknown');
  return NextResponse.json({error:'No fue posible completar la operación. Intenta nuevamente.'},{status:500});
}
