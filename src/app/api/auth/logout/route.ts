import { NextResponse } from 'next/server';
import { configured, routeDb } from '@/lib/supabase';
import { failure, sameOrigin } from '@/lib/http';
import { HttpError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!configured()) return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
    const {client,commit}=await routeDb();
    const {error}=await client.auth.signOut({scope:'local'});
    if(error) throw new HttpError('No pudimos cerrar la sesión. Intenta nuevamente.',503);
    return commit(NextResponse.json({ok:true}));
  } catch(error) {return failure(error);}
}
