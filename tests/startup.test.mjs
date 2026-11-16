import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
const root=new URL('../',import.meta.url);
function element() {
  return {value:'',options:[],style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    addEventListener(){},appendChild(){},remove(){},scrollIntoView(){},setAttribute(){},removeAttribute(){},hasAttribute(){return false;},
    querySelector(){return null;},querySelectorAll(){return [];},getContext(){return new Proxy({},{get:()=>()=>{}});}};
}
test('完整脚本加载和设置初始化；六套牌面映射文件都存在',()=>{
  const elements=new Map(),storage=new Map();
  const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  const context=vm.createContext({console,localStorage,sessionStorage:localStorage,
    document:{addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},
      querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>element(),body:element()},
    innerWidth:1024,innerHeight:768,requestAnimationFrame(){},setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},clearInterval(){},
    navigator:{language:'zh-CN'},window:{addEventListener(){},__deckStyle:'rws'},
    fetch:async()=>new Response('{}'),Response,AbortController,URL,crypto:globalThis.crypto});
  for(const file of ['waite.js','waite_cn.js','cards.js','xyj_lore.js','reading-html.js','reading-history.js','modern-card-notes.js','app.js']) {
    vm.runInContext(readFileSync(new URL(file,root),'utf8'),context,{filename:file});
  }
  vm.runInContext('loadSettings()',context);
  assert.equal(vm.runInContext('aiSettings.engine',context),'official');
  assert.equal(vm.runInContext('DECK.length',context),78);
  for(const style of ['rws','marseille','xiyouji','cartoon','hj','cat']) {
    context.window.__deckStyle=style;
    for(let id=0;id<78;id++) {
      const path=vm.runInContext(`cardImg(${id})`,context);
      assert.ok(existsSync(new URL(path,root)),`${style}: ${path}`);
    }
  }
});
