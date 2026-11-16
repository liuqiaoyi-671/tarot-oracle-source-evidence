import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

// Build-time extraction of trusted repository data, never article text or user input.
// The context has no Node, filesystem or network capability and a bounded runtime.
export async function readLearningCatalog(root) {
 const [cardsSource,appSource]=await Promise.all([
  readFile(path.join(root,'cards.js'),'utf8'),readFile(path.join(root,'app.js'),'utf8')
 ]);
 const spreadLiteral=appSource.match(/const SPREADS = (\{[\s\S]*?\n\});/);
 if(!spreadLiteral) throw new Error('Could not locate current spread definitions');
 const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
 const deckData=vm.runInContext(cardsSource+`\n;({
  majors:DECK.slice(0,22).map(card=>({cardId:card.id,name:{zh:card.nameCN,en:card.name}})),
  decks:GALLERY_DECKS.map(deck=>({key:deck.key,name:DECK_TITLES[deck.key],images:Array.from({length:22},(_,id)=>{
   const imageId=deck.key==='marseille'?(id===8?11:id===11?8:id):id;
   return '/'+deck.imgFn(imageId);
  })}))
 })`,context,{timeout:1000});
 const spreads=vm.runInContext('('+spreadLiteral[1]+')',vm.createContext({}, {codeGeneration:{strings:false,wasm:false}}),{timeout:1000});
 const catalog=JSON.parse(JSON.stringify({...deckData,spreads}));
 for(const deck of catalog.decks) for(const image of deck.images) {
  if(!image.startsWith('/')||image.startsWith('//')||image.includes('..')||image.includes('\\')) throw new Error('Unsafe deck image path');
 }
 return catalog;
}

export function validateLearningCoverage(articles,catalog) {
 const tutorials=articles.filter(a=>a.category==='getting-started'),cards=articles.filter(a=>a.category==='card-meanings'),spreads=articles.filter(a=>a.category==='spreads');
 if(tutorials.length!==8||Array.from({length:8},(_,i)=>`G${String(i+1).padStart(2,'0')}`).some(id=>!tutorials.some(a=>a.id===id))) throw new Error('Missing planned getting-started guide');
 if(cards.length!==22||catalog.majors.some(card=>!cards.some(a=>a.cardId===card.cardId))) throw new Error('All 22 major arcana need complete articles');
 const spreadKeys=Object.keys(catalog.spreads);
 if(spreads.length!==spreadKeys.length||spreadKeys.some(key=>!spreads.some(a=>a.spreadKey===key))) throw new Error('Every current spread needs a complete guide');
}
