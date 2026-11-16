import { SPECIALIST_CARDS, COURT_REFERENCES } from './specialist-book-index.js';
import { BOOK_REFERENCE_INDEX } from './book-reference-index.js';
export function selectBookReferences(cards, question='') {
  const q=String(question).slice(0,1500);
  const domain=/学习|学业|考试|study|exam|school/i.test(q)?'study':/感情|爱情|恋|伴侣|复合|relationship|love|partner/i.test(q)?'love':/工作|事业|职业|career|work|job/i.test(q)?'work':/钱|财|预算|投资|money|budget|financ/i.test(q)?'finance':null;
  const seen=new Set();const results=[];
  for(const card of cards){
    if(!Number.isInteger(card.id)||card.id<0||card.id>77||seen.has(card.id))continue;
    seen.add(card.id); const source=BOOK_REFERENCE_INDEX[card.id];
    const primary = SPECIALIST_CARDS[card.id];
    // Orientation always supplied, including when a topic-specific passage is selected.
    results.push({id:card.id,name:source.name,source:primary.source,locator:primary.locator + (card.reversed?' / reversed':''),orientation:card.reversed?'reversed':'upright',text:primary[card.reversed?'rev':'up'],...(domain&&source.notes[domain]?{application:source.notes[domain],applicationSource:source.source+' / '+source.locator,domain}:{})});
  }
  for (const r of results) {
    if (COURT_REFERENCES[r.id]) r.court = COURT_REFERENCES[r.id];
    if (r.id >= 22 && (r.id - 22) % 14 >= 10) r.editorial = '《跟着大师学塔罗宫廷牌》第1章，编辑概括：宫廷牌可指人物、自己的行事方式、关系角色或情境。先比较这些可能性，再依据牌位和邻牌选择；不要仅凭牌名指定某个人。';
    if (r.id === 23) r.editorial = 'Paul Fenton-Smith, The Tarot Revealed, Two of Wands / General meaning，编辑概括：权杖二强调权衡与作出选择，须区分计划和已经行动；不能据此认定用户已换工作或搬家。';
  }
  return results;
}
