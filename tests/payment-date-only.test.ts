import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { paymentInput } from '../src/lib/finance';

test('all payment concepts use only the payment date; obsolete fields are rejected',()=>{
 const input={request_id:crypto.randomUUID(),lease_id:crypto.randomUUID(),amount:650000,paid_on:'2026-09-01',method:'transfer',payer_name:'Test payer'};
 for(const concept of ['rent','advance','deposit']){
  assert.ok(paymentInput.safeParse({...input,concept}).success);
  for(const extra of [{period_start:'2026-09-01'},{period_end:'2026-09-30'},{months:['2026-09']},{paid_on:'2026-02-30'}])
   assert.equal(paymentInput.safeParse({...input,concept,...extra}).success,false);
 }
});

test('form, private details, public verification and PNG omit months and periods',async()=>{
 for(const path of ['src/components/payment-form.tsx','src/components/receipt-details.tsx','src/lib/receipt-image.tsx','src/app/verificar/[code]/page.tsx']){
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/period_start|period_end|Mes\(es\)|Periodo|type="month"|paymentPeriod/);
  assert.match(source,/paid_on/);
 }
});
