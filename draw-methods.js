// Presentation methods share one shuffled deck; switching never redraws it.
function renderRitualSettings() {
  let box = document.getElementById('ritual-settings');
  if (!box) {
    const btn = document.getElementById('shuffle-btn');
    if (!btn) return;
    box = document.createElement('div'); box.id = 'ritual-settings';
    btn.parentNode.insertBefore(box, btn);
  }
  const selected = localStorage.getItem('tarot-shuffle-method') || 'mix';
  box.innerHTML = `<label for="shuffle-method">${t('Shuffle ritual','洗牌方式')}</label> <select id="shuffle-method" class="modal-select">${[['mix','Table wash','桌面混洗'],['cut','Cut the deck','三叠切牌'],['riffle','Interleave','交错洗牌']].map(([v,en,cn])=>`<option value="${v}" ${selected===v?'selected':''}>${t(en,cn)}</option>`).join('')}</select>`;
  box.querySelector('select').onchange = e => localStorage.setItem('tarot-shuffle-method',e.target.value);
}
function showShuffleRitual() {
  const el=document.createElement('div');
  const method=document.getElementById('shuffle-method')?.value || 'mix';
  el.className='shuffle-ritual ritual-'+method; el.setAttribute('aria-hidden','true');
  const back=typeof cardBackImg==='function'?cardBackImg():'';
  for(let i=0;i<12;i++){
    const card=document.createElement('span'); card.style.setProperty('--i',i);
    card.style.setProperty('--turn',`${i*31}deg`);
    if(back) card.style.backgroundImage=`url("${back}")`;
    el.appendChild(card);
  }
  document.getElementById('shuffle-btn').after(el);
  return el;
}
function buildMethodFan(stage,wrap,backUrl){
  wrap.classList.remove('arc-scroll','grid-scroll'); stage.className='method-stage';
  wrap.style.cssText='display:block;height:auto;overflow:visible;opacity:1';
  stage.style.cssText='display:flex;flex-wrap:wrap;justify-content:center;gap:16px;min-width:0;height:auto;padding:20px';
  const mode=getFanMode();
  const instruction=document.getElementById('fan-instr');
  instruction.textContent=mode==='number'?t('Choose an unused position in the shuffled deck.','选择洗牌后牌组中尚未抽取的序号。'):t('Choose the top card from any pile.','从任意一叠的顶部取牌，可多次选择同一叠。');
  const used=()=>new Set(drawnEntries.map(e=>e.card.id));
  const makeBack=label=>{
    const b=document.createElement('button'); b.type='button';b.className='method-card';
    if(backUrl)b.style.backgroundImage=`url("${backUrl}")`;
    b.setAttribute('aria-label',label);stage.appendChild(b);return b;
  };
  if(mode==='number'){
    const group=document.createElement('div');group.className='number-picker';
    const label=document.createElement('label');label.htmlFor='draw-number';label.textContent=t('Card position','牌的位置');
    const select=document.createElement('select');select.id='draw-number';
    fanCards.forEach((_,i)=>select.add(new Option(String(i+1),String(i))));
    group.append(label,select);stage.appendChild(group);
    const b=makeBack(t('Draw selected position','抽取所选序号'));
    const text=document.createElement('span');text.textContent=t('Draw this number','抽取这个序号');b.appendChild(text);
    b.onclick=()=>{
      const i=Number(select.value);if(!Number.isInteger(i)||!fanCards[i]||used().has(fanCards[i].id))return;
      b.classList.remove('drawn'); onFanCardClick(b,i);
      select.selectedOptions[0]?.remove();b.style.pointerEvents='';b.style.filter='';b.style.visibility='visible';
      if(!select.options.length||drawnEntries.length>=SPREADS[currentSpread].count){b.disabled=true;select.disabled=true;}
    };
  }else{
    const size=Math.ceil(fanCards.length/3);
    for(let pile=0;pile<3;pile++){
      const indices=fanCards.map((_,i)=>i).slice(pile*size,(pile+1)*size);
      const b=makeBack(t(`Draw from pile ${pile+1}`,`从第 ${pile+1} 叠取牌`));
      const text=document.createElement('span');b.appendChild(text);
      const update=()=>{const left=indices.filter(i=>!used().has(fanCards[i].id)).length;text.textContent=t(`Pile ${pile+1} · ${left}`,`第 ${pile+1} 叠 · ${left} 张`);b.disabled=!left;};update();
      b.onclick=()=>{const i=indices.find(i=>!used().has(fanCards[i].id));if(i===undefined)return;
        b.classList.remove('drawn');onFanCardClick(b,i);b.style.pointerEvents='';b.style.filter='';b.style.visibility='visible';update();};
    }
  }
}
