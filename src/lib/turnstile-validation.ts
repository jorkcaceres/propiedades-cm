// Called only by server routes with a server-held secret; never trust the widget alone.
export async function verifyTurnstile(
  token: unknown,
  config: { secret: string; hostname: string },
  request: typeof fetch = fetch,
): Promise<'valid' | 'invalid' | 'unavailable'> {
  if (!config.secret || !config.hostname) return 'unavailable';
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) return 'invalid';
  try {
    const response = await request('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: config.secret, response: token }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return 'unavailable';
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object') return 'unavailable';
    const verdict = result as Record<string, unknown>;
    return verdict.success === true && verdict.hostname === config.hostname && verdict.action === 'login'
      ? 'valid' : 'invalid';
  } catch { return 'unavailable'; }
}
