import test from 'node:test';
import assert from 'node:assert/strict';
import { recordInput,recordMutation,isModule } from '../src/lib/modules';
test('record payloads validate required fields and reject privileged columns',()=>{
  const person={name:' Test person ',document_type:'CC',document_number:'abc123'};
  assert.equal(recordInput('tenants',person).document_number,'ABC123');
  assert.equal(recordInput('landlords',person).name,'Test person');
  for(const patch of [{active:false},{version:30},{created_at:'yesterday'},{name:''},{document_number:'1'},{email:'invalid'}])assert.throws(()=>recordInput('tenants',{...person,...patch}));
  assert.equal(isModule('__proto__'),false);assert.equal(isModule('pcm_members'),false);
});
test('property numeric fields are optional, bounded and associated with an owner',()=>{
  const property={name:'Test home',address:'Test street',city:'Soledad',department:'Atlántico',property_type:'casa',landlord_id:'30000000-0000-4000-8000-000000000001',bedrooms:'2',bathrooms:'',area_m2:'40.50'};
  assert.equal(recordInput('properties',property).bedrooms,2);
  assert.equal(recordInput('properties',property).bathrooms,null);
  assert.equal(recordInput('properties',property).area_m2,40.5);
  for(const patch of [{landlord_id:''},{bedrooms:'-1'},{bedrooms:'1.5'},{area_m2:'0'},{city:''}])assert.throws(()=>recordInput('properties',{...property,...patch}));
});
test('edit and archive require explicit version; no combined privileged mutation',()=>{
  const valid={action:'archive',id:'30000000-0000-4000-8000-000000000001',version:1,active:false};
  assert.equal(recordMutation.safeParse(valid).success,true);
  assert.equal(recordMutation.safeParse({...valid,values:{name:'sneak'}}).success,false);
  assert.equal(recordMutation.safeParse({...valid,version:undefined}).success,false);
});
