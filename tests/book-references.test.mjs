import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOK_REFERENCE_INDEX } from '../lib/book-reference-index.js';
import { selectBookReferences } from '../lib/book-references.js';
import { onRequestPost } from '../functions/api/book-references.js';
test('78个牌号独立对应正逆位参考，领域仅由问题范围选择',()=>{
 assert.equal(Object.keys(BOOK_REFERENCE_INDEX).length,78);
 for(let id=0;id<78;id++) {
  const up=selectBookReferences([{id,reversed:false}],'career')[0];
  const rev=selectBookReferences([{id,reversed:true}],'study')[0];
  assert.ok(up.text && rev.text);assert.notEqual(up.text,rev.text);
  assert.ok(up.text.length<=401 && rev.text.length<=401);
  assert.equal(up.name,BOOK_REFERENCE_INDEX[id].name);assert.match(up.source,/Paul Fenton-Smith/);assert.ok(up.locator);if(up.application)assert.match(up.applicationSource,/umi/);
  if(up.application)assert.equal(up.domain,'work');
  if(rev.application)assert.equal(rev.domain,'study');
 }
 assert.match(selectBookReferences([{id:35,reversed:false}])[0].editorial,/宫廷牌/);
 assert.match(selectBookReferences([{id:23,reversed:false}])[0].editorial,/Paul Fenton-Smith/);
 assert.equal(selectBookReferences([{id:0,reversed:false},{id:0,reversed:true}]).length,1);
});
test('资料接口限制牌数、牌号、输入长度；不给出整本书',async()=>{
 const call=body=>onRequestPost({request:new Request('https://local/api/book-references',{method:'POST',body:JSON.stringify(body)})});
 assert.equal((await call({cards:[{id:78,reversed:false}],question:''})).status,400);
 assert.equal((await call({cards:Array.from({length:13},(_,id)=>({id,reversed:false})),question:''})).status,400);
 assert.equal((await call({cards:[],question:'x'.repeat(5001)})).status,413);
 const response=await call({cards:[{id:0,reversed:true}],question:'career'});
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.references.length,1);assert.equal(data.references[0].orientation,'reversed');
});
