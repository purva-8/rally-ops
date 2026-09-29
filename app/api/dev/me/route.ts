import { NextResponse } from 'next/server';
import { getDevUser } from '@/lib/devAdmin';

export async function GET() {
  return NextResponse.json({ ok: !!(await getDevUser()) });
}
