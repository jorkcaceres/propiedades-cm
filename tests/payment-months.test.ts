import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { monthsToPeriod,nextMonth,paymentPeriod } from '../src/lib/payment-months';
import { paymentInput } from '../src/lib/finance';
const lease={start_date:'2024-01-01',end_date:null};
test('monthly selection maps to exact calendar boundaries, including leap years and year changes',()=>{
 assert.deepEqual(monthsToPeriod(['2026-09'],lease),{period_start:'2026-09-01',period_end:'2026-09-30'});
 assert.deepEqual(monthsToPeriod(['2027-02','2026-12','2027-01'],lease),{period_start:'2026-12-01',period_end:'2027-02-28'});
 assert.equal(monthsToPeriod(['2024-02'],lease).period_end,'2024-02-29');
 assert.equal(nextMonth('2026-12'),'2027-01');assert.equal(nextMonth('9999-12'),'');assert.equal(nextMonth('invalid'),'');
});
test('partial lease months are clipped, invalid or gapped month selections never imply extra coverage',()=>{
 assert.deepEqual(monthsToPeriod(['2026-09'],{start_date:'2026-09-15',end_date:'2026-09-25'}),{period_start:'2026-09-15',period_end:'2026-09-25'});
 for(const months of [[],[''],['2026-13'],['0000-01'],['2026-09','2026-09'],['2026-09','2026-11'],['2023-12']])assert.throws(()=>monthsToPeriod(months,lease));
 assert.throws(()=>monthsToPeriod(['2026-10'],{...lease,end_date:'2026-09-30'}));
});
test('deposits ignore month selection and month-based rent preserves the existing API contract',()=>{
 assert.deepEqual(paymentPeriod('deposit',['2026-09']),{period_start:null,period_end:null});
 assert.throws(()=>paymentPeriod('rent',['2026-09']));
 assert.ok(paymentInput.safeParse({request_id:crypto.randomUUID(),lease_id:crypto.randomUUID(),amount:650000,concept:'rent',paid_on:'2026-10-01',...paymentPeriod('rent',['2026-09'],lease),method:'transfer',payer_name:'Local test'}).success);
});
test('payment form exposes months instead of start/end date inputs',async()=>{
 const source=await readFile(new URL('../src/components/payment-form.tsx',import.meta.url),'utf8');
 assert.match(source,/Mes\(es\) que paga/);assert.match(source,/type="month"/);
 assert.doesNotMatch(source,/Periodo desde|Periodo hasta|name="period_start"|name="period_end"/);
});
