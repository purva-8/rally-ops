import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  // Only paths on this site: "@evil.com" or "//evil.com" would otherwise send people elsewhere after login
  const asked = searchParams.get('next') ?? '/events';
  const next = asked.startsWith('/') && !asked.startsWith('//') && !asked.startsWith('/\\') ? asked : '/events';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
