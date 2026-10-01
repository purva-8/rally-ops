import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Finishes a one-time sign-in link made with a token hash (used by the developer "sign in as" tool)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = (searchParams.get('type') ?? 'magiclink') as EmailOtpType;
  const next = searchParams.get('next') ?? '/profile';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/profile';

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
