/**
 * WEC OS settings. All server-side: no NEXT_PUBLIC_ value, so nothing is inlined at
 * build, the public site builds without any of them, and the browser never holds a
 * Supabase key. Unset, /os says it is not configured and nothing else changes.
 */
export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function osSiteUrl() {
  return (process.env.WEC_OS_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
