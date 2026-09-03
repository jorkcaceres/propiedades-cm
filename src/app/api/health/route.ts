import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ status: 'ok', release: '0.1.0', stage: 'setup', accessEnabled: false });
}
