import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderReceiptV2 } from '../src/lib/receipt-image';
import type { Receipt } from '../src/lib/finance';
test('receipt renderer creates a real PNG for valid and void states, including maximum-length fields',async()=>{
 const logo='data:image/png;base64,'+(await readFile(new URL('../public/brand/logo-white.png',import.meta.url))).toString('base64');
 const receipt:Receipt={id:crypto.randomUUID(),payment_id:crypto.randomUUID(),code:'PCM-'+crypto.randomUUID().replaceAll('-','').toUpperCase(),renderer_version:1,issued_at:'2026-09-04T12:00:00Z',snapshot:{property_name:'Vivienda de prueba',property_address:'Dirección de prueba',tenant_name:'Arrendatario de prueba',landlord_name:'Arrendador de prueba',payer_name:'Pagador de prueba',amount:650000,concept:'rent',paid_on:'2026-09-01',method:'transfer',reference:'PRUEBA LOCAL',currency:'COP'}};
 for(const voided of [false,true]){
  receipt.renderer_version=voided?2:1;
  const response=await renderReceiptV2(receipt,voided,'https://propiedadescm.jorkcaceres.com',logo);const png=Buffer.from(await response.arrayBuffer());assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),720);assert.ok(png.length>10000);assert.match(response.headers.get('cache-control')||'',/no-store/);
  const historical={...receipt,snapshot:{...receipt.snapshot,period_start:'2026-08-01',period_end:'2026-08-31'}};
  const historicalResponse=await renderReceiptV2(historical,voided,'https://propiedadescm.jorkcaceres.com',logo);
  assert.deepEqual(Buffer.from(await historicalResponse.arrayBuffer()),png,'Legacy period data never changes the current PNG');
  receipt.snapshot={...receipt.snapshot,property_name:'W'.repeat(150),property_address:'W'.repeat(250),payer_name:'W'.repeat(150),tenant_name:'W'.repeat(150),landlord_name:'W'.repeat(150),reference:'W'.repeat(120),amount:999999999};
 }
});
