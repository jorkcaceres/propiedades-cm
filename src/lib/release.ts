export const RELEASE = '0.2.0';

// Operational switch stays off until Auth, CAPTCHA and Hostinger are configured.
// Read at request time so deployment configuration, not a code edit, controls access.
export function authEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.PCM_AUTH_ENABLED !== 'true') return false;
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || !env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) return false;
  try { return new URL(env.NEXT_PUBLIC_SUPABASE_URL || '').protocol === 'https:'; }
  catch { return false; }
}
