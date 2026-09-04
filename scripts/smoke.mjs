import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const env = { ...process.env, PORT: String(port), NEXT_TELEMETRY_DISABLED: '1' };
delete env.NEXT_PUBLIC_SUPABASE_URL;
delete env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
delete env.SUPABASE_SECRET_KEY;
delete env.SETUP_TOKEN;
delete env.TURNSTILE_SECRET_KEY;
delete env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
delete env.PCM_AUTH_ENABLED;
env.APP_URL = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
child.stdout.on('data', d => { logs += d; });
child.stderr.on('data', d => { logs += d; });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw Error(logs);
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  assert.ok(ready, `Production server did not start: ${logs}`);
  for (const path of ['/', '/panel','/panel/landlords','/panel/tenants','/panel/properties','/panel/users','/panel/audit','/panel/leases','/panel/payments','/panel/receipts','/panel/payments/10000000-0000-4000-8000-000000000001','/panel/receipts/PCM-1234567890124234A234123456789012']) {
    const response = await fetch(base + path);
    assert.ok(response.url.endsWith('/login'));
    assert.equal(response.status, 200);
  }
  const login = await fetch(`${base}/login`);
  const html = await login.text();
  assert.match(html, /Bienvenido a casa/);
  assert.match(html, /fieldset disabled/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /© 2026\. Jorkcáceres\./);
  assert.match(html, /\/brand\/favicon\.png/);
  assert.match(html, /src="\/brand\/logo-white\.png"/);
  assert.doesNotMatch(html, /tu@correo\.com|CÁCERES MARZOLA|Soledad, Atlántico|Propiedades CM · Gestión de arrendamientos/);
  assert.doesNotMatch(html, /<img[^>]+src="\/logo\.png"/);
  assert.doesNotMatch(html, /<input[^>]+id="email"[^>]+placeholder=/);
  assert.match(login.headers.get('cache-control') || '', /no-store/);
  assert.equal(login.headers.get('x-frame-options'), 'DENY');
  for (const asset of ['favicon', 'logo-white', 'logo-color']) {
    const png = await fetch(`${base}/brand/${asset}.png`);
    assert.equal(png.status, 200);
    assert.match(png.headers.get('content-type') || '', /image\/png/);
  }
  const blocked = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(blocked.status, 503);
  assert.equal((await blocked.json()).error.includes('no está habilitado'), true);
  assert.equal((await fetch(`${base}/api/auth/logout`,{method:'POST'})).status,403);
  assert.equal((await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{Origin:base}})).status,200);
  assert.equal((await fetch(`${base}/api/auth/login`)).status,405);
  for(const endpoint of ['records/landlords','records/tenants','records/properties','members','finance/leases','finance/payments','finance/issue','finance/void']) {
    assert.equal((await fetch(`${base}/api/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  }
  assert.equal((await fetch(`${base}/not-a-page`)).status, 404);
  assert.equal((await fetch(`${base}/api/receipts/PCM-1234567890124234A234123456789012/png`)).status,503);
  assert.equal((await fetch(`${base}/verificar/PCM-0001`)).status,404);
  const verify=await fetch(`${base}/verificar/PCM-1234567890124234A234123456789012`);
  assert.match(await verify.text(),/Verificación no disponible/);
  assert.match(verify.headers.get('cache-control')||'',/no-store/);
  console.log('PASS: production startup, redirects, login, disabled access, security headers, logo and 404. No Supabase connection used.');
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
}
