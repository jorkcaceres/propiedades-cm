import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyTurnstile } from '../src/lib/turnstile-validation';

const config = { secret: 'unit-test-secret', hostname: 'propiedadescm.jorkcaceres.com' };
const verdict = { success: true, hostname: config.hostname, action: 'login' };
const respond = (data: unknown): typeof fetch => async () => Response.json(data);

test('Turnstile requires a token and server configuration without making a request', async () => {
  const noRequest: typeof fetch = async () => { assert.fail('Must not call Cloudflare'); };
  for (const token of [undefined, '', ' ', 123, 'a'.repeat(2049)]) {
    assert.equal(await verifyTurnstile(token, config, noRequest), 'invalid');
  }
  assert.equal(await verifyTurnstile('token', { ...config, secret: '' }, noRequest), 'unavailable');
});

test('Turnstile accepts only verified tokens for this hostname and login action', async () => {
  assert.equal(await verifyTurnstile('token', config, respond(verdict)), 'valid');
  for (const data of [
    { ...verdict, success: false, 'error-codes': ['timeout-or-duplicate'] },
    { ...verdict, hostname: 'other.example' },
    { ...verdict, action: 'other' },
    { success: true },
  ]) assert.equal(await verifyTurnstile('token', config, respond(data)), 'invalid');
});

test('Turnstile fails closed on outages and malformed responses', async () => {
  assert.equal(await verifyTurnstile('token', config, async () => { throw Error('Network unavailable'); }), 'unavailable');
  assert.equal(await verifyTurnstile('token', config, async () => new Response('', { status: 503 })), 'unavailable');
  assert.equal(await verifyTurnstile('token', config, async () => new Response('not json')), 'unavailable');
});

test('Turnstile sends the token to Siteverify without logging or caching secrets', async () => {
  const request: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(options?.method, 'POST');
    assert.equal(options?.cache, 'no-store');
    assert.ok(options?.signal);
    assert.deepEqual(JSON.parse(String(options?.body)), { secret: config.secret, response: 'token' });
    return Response.json(verdict);
  };
  assert.equal(await verifyTurnstile('token', config, request), 'valid');
});
