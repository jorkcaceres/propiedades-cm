import { NextResponse } from 'next/server';
import { authEnabled, RELEASE } from '@/lib/release';
export const dynamic='force-dynamic';
export async function GET() {
  return NextResponse.json({ status: 'ok', release: RELEASE, stage: authEnabled() ? 'access' : 'setup', accessEnabled: authEnabled() },{headers:{'Cache-Control':'private, no-store'}});
}
