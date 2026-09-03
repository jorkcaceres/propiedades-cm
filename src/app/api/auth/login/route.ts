import { NextResponse } from 'next/server';
// Access is deliberately closed: no credentials are read or stored in this release.
export async function POST() {
  return NextResponse.json(
    { error: 'El acceso aún no está habilitado. La plataforma está en configuración.' },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
