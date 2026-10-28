// Lets `node --test` load the app's route files: maps the @/ alias and swaps the Supabase clients for an in-memory fake
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const fake = new URL('./fakeSupabase.ts', import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (spec === '@/lib/supabase/server' || spec === '@/lib/supabase/admin') return { url: fake, shortCircuit: true };
  if (spec.startsWith('@/') || (spec.startsWith('.') && ctx.parentURL?.startsWith(root.href) && !ctx.parentURL.includes('node_modules'))) {
    const base = spec.startsWith('@/') ? new URL(spec.slice(2), root) : new URL(spec, ctx.parentURL);
    for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
      const u = new URL(base.href + ext);
      if (existsSync(u) && !u.pathname.endsWith('/')) return { url: u.href, shortCircuit: true };
    }
  }
  if (spec === 'next/server') return next('next/server.js', ctx);
  return next(spec, ctx);
}
