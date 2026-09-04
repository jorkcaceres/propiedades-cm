import { NextResponse } from 'next/server';
import { authEnabled } from '@/lib/release';
import { authenticate } from '@/lib/auth-flow';
import { routeDb } from '@/lib/supabase';
import { body, failure, sameOrigin } from '@/lib/http';

function closed() {
  return NextResponse.json(
    { error: 'El acceso aún no está habilitado. La plataforma está en configuración.' },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: Request) {
  if (!authEnabled()) return closed();
  try {
    sameOrigin(request);
    const payload = await body(request);
    const {client,commit} = await routeDb();
    await authenticate(client,payload);
    return commit(NextResponse.json({ok:true}));
  } catch (error) { return failure(error); }
}
