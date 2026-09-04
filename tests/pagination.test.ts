import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { pageRequest,pageCount,pageHref,pageSize } from '../src/lib/pagination';
import { Pagination } from '../src/components/pagination';

test('all pagination boundaries use exactly ten inclusive records',()=>{
 assert.equal(pageSize,10);
 assert.deepEqual(pageRequest(undefined),{page:1,from:0,to:9});
 assert.deepEqual(pageRequest('2'),{page:2,from:10,to:19});
 assert.deepEqual(pageRequest('3'),{page:3,from:20,to:29});
 for(const value of ['0','-2','abc','2x','1.5',['2','3'],'Infinity'])assert.equal(pageRequest(value).page,1);
 assert.equal(pageCount(0),1);assert.equal(pageCount(10),1);assert.equal(pageCount(11),2);assert.equal(pageCount(30),3);
});
test('pagination links preserve filters and encode names safely',()=>{
 const url=new URL(pageHref('/panel/landlords',2,{q:'Cáceres & familia',status:'inactive'}),'https://example.test');
 assert.equal(url.searchParams.get('q'),'Cáceres & familia');assert.equal(url.searchParams.get('status'),'inactive');assert.equal(url.searchParams.get('page'),'2');
});
test('paginator renders empty, first, middle, last and out-of-range states',()=>{
 const render=(page:number,total:number)=>renderToStaticMarkup(React.createElement(Pagination,{page,total,path:'/panel/audit'}));
 assert.match(render(1,0),/Página 1 de 1/);assert.doesNotMatch(render(1,10),/href=/);
 assert.match(render(1,11),/page=2/);assert.doesNotMatch(render(1,11),/page=0/);
 assert.match(render(2,30),/page=1/);assert.match(render(2,30),/page=3/);
 assert.match(render(3,30),/Página 3 de 3/);assert.doesNotMatch(render(3,30),/page=4/);
 assert.match(render(99,11),/Volver a la primera/);assert.doesNotMatch(render(99,11),/Página 99 de 2/);
});
test('every record list uses shared pagination and a stable newest-first order',async()=>{
 for(const [route,field] of [['[module]','created_at'],['leases','created_at'],['payments','created_at'],['receipts','issued_at'],['users','created_at'],['audit','occurred_at']]){
  const source=await readFile(new URL(`../src/app/panel/${route}/page.tsx`,import.meta.url),'utf8');
  assert.match(source,/pageRequest\(/,route);assert.match(source,/<Pagination /,route);assert.match(source,/\.range\(from,to\)/,route);
  assert.ok(source.includes(`.order('${field}',{ascending:false}).order('id',{ascending:false})`),route);
  assert.doesNotMatch(source,/limit\(50\)|page\*20/,route);
 }
});
test('approved copy removes obsolete notices and centers brand-column copyright',async()=>{
 const login=await readFile(new URL('../src/components/login.tsx',import.meta.url),'utf8');
 const home=await readFile(new URL('../src/app/panel/page.tsx',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/app/globals.css',import.meta.url),'utf8');
 assert.match(login,/Bienvenido a tus propiedades/);assert.doesNotMatch(login,/Bienvenido a casa|Administración familiar|Necesitas acceso o recuperar tu cuenta/);
 assert.doesNotMatch(home,/Para entregar tu primer recibo/);assert.match(css,/\.brand-foot\{justify-content:center;text-align:center;width:100%\}/);
});
