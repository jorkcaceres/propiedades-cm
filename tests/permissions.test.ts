import assert from 'node:assert/strict';
import test from 'node:test';
import { allPermissions, can, profilePermissions, type Member } from '../src/lib/permissions';
import { authEnabled } from '../src/lib/release';
const member: Member = { id:'test',name:'Example',email:'example@example.test',active:true,is_admin:false,permissions:['properties.view'] };
test('minimum privilege denies ungranted actions', () => {
  assert.equal(can(member,'properties.view'),true);
  assert.equal(can(member,'properties.edit'),false);
  assert.equal(can(member,'users.manage'),false);
});
test('suspended administrators cannot act', () => {
  assert.equal(can({...member,is_admin:true},'users.manage'),true);
  assert.equal(can({...member,is_admin:true,active:false},'users.manage'),false);
});
test('read-only profile excludes mutations and user management', () => {
  assert.ok(profilePermissions('consulta').length > 0);
  assert.ok(profilePermissions('consulta').every(p=>p.endsWith('.view')&&!p.startsWith('users.')));
  assert.equal(new Set(allPermissions).size,allPermissions.length);
});
test('access stays closed without explicit configuration',()=>assert.equal(authEnabled({}),false));
