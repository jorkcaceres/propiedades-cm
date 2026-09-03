import { NextResponse } from 'next/server';
import { AUTH_READY } from '@/lib/release';
import { verifyTurnstile } from '@/lib/turnstile-validation';
import { body, failure, sameOrigin } from '@/lib/http';

function closed() {
  return NextResponse.json(
    { error: 'El acceso aún no está habilitado. La plataforma está en configuración.' },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: Request) {
  // No credentials are read or stored while the initial release remains closed.
  if (!AUTH_READY) return closed();
  try {
    sameOrigin(request);
    const payload = await body(request);
    const result = await verifyTurnstile(payload?.turnstileToken, {
      secret: process.env.TURNSTILE_SECRET_KEY || '',
      hostname: new URL(process.env.APP_URL || 'https://propiedadescm.jorkcaceres.com').hostname,
    });
    if (result !== 'valid') {
      return NextResponse.json({ error: result === 'invalid'
        ? 'Completa nuevamente la verificación de seguridad.'
        : 'La verificación de seguridad no está disponible. Intenta más tarde.' },
      { status: result === 'invalid' ? 403 : 503, headers: { 'Cache-Control': 'private, no-store' } });
    }
    // Future authentication must run AFTER server-side verification, never before.
    // A valid captcha is not authorization and must not open this release.
    return closed();
  } catch (error) { return failure(error); }
}
