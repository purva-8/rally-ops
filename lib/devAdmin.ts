import { createClient } from '@/lib/supabase/server';

// Developer access is an allowlist of emails, checked on the server for every request.
// Set DEV_ADMIN_EMAILS (comma separated) in Vercel to change it.
const allowed = () =>
  (process.env.DEV_ADMIN_EMAILS ?? 'purvahk08@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export async function getDevUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !allowed().includes(user.email.toLowerCase())) return null;
  return user;
}
