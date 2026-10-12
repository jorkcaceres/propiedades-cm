import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DOCUMENT_BYTES,documentMutation,isDocumentScope,isPdf,referenceInput,safePdfName } from '../src/lib/assets';

test('property references are flexible but bounded',()=>{
 const value=referenceInput.parse({property_id:'30000000-0000-4000-8000-000000000001',identifier_type:' Póliza ',identifier:' 2415852 ',company:' MAPFRE '});
 assert.equal(value.identifier_type,'Póliza');assert.equal(value.company,'MAPFRE');
 assert.throws(()=>referenceInput.parse({...value,identifier:''}));
 assert.throws(()=>referenceInput.parse({...value,service:'Seguro de vivienda'}));
 assert.throws(()=>referenceInput.parse({...value,unexpected:true}));
});
test('document operations and PDF signatures are validated',()=>{
 assert.equal(MAX_DOCUMENT_BYTES,20*1024*1024);assert.equal(isDocumentScope('property'),true);assert.equal(isDocumentScope('other'),false);
 assert.equal(isPdf(new TextEncoder().encode('%PDF-1.7')),true);assert.equal(isPdf(new TextEncoder().encode('<html>')),false);
 assert.equal(safePdfName('../contrato.pdf'),'.._contrato.pdf');
 assert.equal(documentMutation.safeParse({action:'rename',id:'30000000-0000-4000-8000-000000000001',version:1,name:'Contrato'}).success,true);
 assert.equal(documentMutation.safeParse({action:'delete',id:'30000000-0000-4000-8000-000000000001',version:0}).success,false);
});
