import { NextResponse } from 'next/server';
// No sessions can be established in release 0.1.0.
export async function POST() {
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
