import { selectBookReferences } from '../../lib/book-references.js';
import { json } from '../../lib/auth.js';
export async function onRequestPost({request}) {
  if(Number(request.headers.get('content-length'))>5000)return json({error:'Request too large'},413);
  const raw=await request.text();if(raw.length>5000)return json({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request'},400);}
  if(!body||!Array.isArray(body.cards)||body.cards.length>12||body.cards.some(c=>!c||!Number.isInteger(c.id)||c.id<0||c.id>77||typeof c.reversed!=='boolean')||typeof body.question!=='string'||body.question.length>1500)return json({error:'Invalid request'},400);
  return json({references:selectBookReferences(body.cards,body.question)});
}
