/* Contextual onboarding: observes the app but never invokes reading, draw, save or reset. */
(() => {
 'use strict';
 const KEY='tarot-tour-v1', copy=window.TAROT_TOUR_COPY, flows=window.TAROT_TOUR_STEPS;
 const $=s=>document.querySelector(s);
 let spacer,root,bubble,frame,branch='main',index=-1,active=false,history=[],opener,previousTarget,scheduled=false,lastText='',sessionStatus='in-progress';
 const locale=()=>document.documentElement.lang.startsWith('zh')?'zh':'en';
 const label=k=>copy.labels[k]?.[locale()]||k;
 const snapshot=()=>window.getTarotTourState?.()||{drawn:0,required:1,revealed:0,busy:false};
 const visible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
 const store=status=>{sessionStatus=status;try{localStorage.setItem(KEY,JSON.stringify({status,branch,step:index,version:1}));}catch{}};
 function mount(){
  if(root)return;
  root=document.createElement('div');root.id='tarot-tour';root.hidden=true;
  root.innerHTML='<div class="tour-frame" aria-hidden="true"></div><section class="tour-bubble" role="dialog" aria-labelledby="tour-title" aria-describedby="tour-description" tabindex="-1"><div class="tour-top"><small id="tour-progress"></small><button type="button" data-tour-action="close" class="tour-close">×</button></div><h2 id="tour-title"></h2><p id="tour-description"></p><p id="tour-note" role="status" aria-live="polite"></p><p id="tour-count" aria-live="polite"></p><div class="tour-buttons"></div></section>';
  spacer=document.createElement('div');spacer.id='tour-scroll-space';spacer.hidden=true;spacer.setAttribute('aria-hidden','true');spacer.style.cssText='height:100vh;pointer-events:none';document.body.append(spacer,root);bubble=$('.tour-bubble');frame=$('.tour-frame');
  root.addEventListener('click',e=>{const action=e.target.closest('[data-tour-action]')?.dataset.tourAction;if(!action)return;
   if(action==='close'||action==='skip')return stop('skipped');
   if(action==='done')return stop('completed');
   if(action==='back'){const last=history.pop();if(last){[branch,index]=last;previousTarget=null;render(true);}return;}
   if(action==='ai'||action==='other')return beginBranch(action);
   if(action==='closeSettings'){document.getElementById('settings-modal').classList.remove('open');return beginBranch('other');}
   if(action==='finish')return move('done');
   if(action==='advancedSkip'){index=flows.ai.findIndex(s=>s[0]==='A9')-1;return next();}
   if(action==='start')return beginMain();
   next();
  });
 }
 function stop(status){store(status);active=false;root.hidden=true;spacer.hidden=true;previousTarget=null;opener?.isConnected&&opener.focus?.({preventScroll:true});}
 function start(){
  mount();opener=document.activeElement;active=true;branch='main';index=-1;history=[];lastText='';previousTarget=null;store('in-progress');root.hidden=false;spacer.hidden=false;render(true);
 }
 function beginMain(){
  const s=snapshot();
  if(s.drawn>=s.required)move('8');
  else if(s.drawn>0)move('7');
  else if(visible($('#fan-stage-wrap'))&&$('#fan-stage')?.children.length)move('6');
  else move('1');
 }
 function beginBranch(name){
  history.push([branch,index]);branch=name;index=0;previousTarget=null;store(sessionStatus);
  if(name==='other'&&visible($('#settings-modal.open'))){
   // Stay in the real settings dialog until the user explicitly closes it.
   branch='ai';index=flows.ai.findIndex(s=>s[0]==='A11');
  }
  render(true);
 }
 function move(id){history.push([branch,index]);if(id==='done')index=-2;else index=flows[branch].findIndex(s=>s[0]===id);previousTarget=null;render(true);}
 function next(){
  if(index===-1)return beginMain();
  if(index===-2)return stop('completed');
  const current=flows[branch][index]?.[0];
  if(current==='8')return move('9');
  if(current==='9')return move('11');
  history.push([branch,index]);index++;
  if(index>=flows[branch].length){index=-2;render(true);return;}
  // Hidden options are not created or forced visible just for the tutorial.
  while(index<flows[branch].length){
   const [id,sel]=flows[branch][index];
   if((branch==='ai'&&!['A1','A11'].includes(id))||id==='4'){
    if(sel&&!visible($(sel))){index++;continue;}
   }
   break;
  }
  if(index>=flows[branch].length)index=-2;
  previousTarget=null;store(sessionStatus);render(true);
 }
 function ensureMenu(target){if(target?.closest('.header-menu-popover')&&!$('#site-menu').open)$('#site-menu').open=true;}
 function render(focus=false){
  if(!active)return;
  const s=snapshot(), welcome=index===-1, done=index===-2;
  const step=welcome?['0',null]:done?['done',null]:flows[branch][index];if(!step)return;
  const [id,selector,mode]=step;
  if(id==='11'&&sessionStatus==='in-progress')store('basic-completed');
  let target=selector?$(selector):null;
  if(id==='A10')target=$('.deck-style-btn')?.parentElement;
  if(id==='A9')target=$('.persona-btn')?.parentElement;
  if(id==='9')target=visible($('#reveal-btn'))?$('#reveal-btn'):visible($('#summary-text'))?$('#summary-text'):$('#selected-row');
  if(id==='A1'&&visible($('#settings-modal.open'))) {next();return;}
  if(id==='5'&&visible($('#fan-stage-wrap'))&&$('#fan-stage')?.children.length&&!$('#shuffle-btn').disabled){move(s.drawn?'7':'6');return;}
  if((id==='6'||id==='draw'||id==='7')&&s.drawn>=s.required&&visible($('#reveal-btn'))){move('8');return;}
  if((id==='6'||id==='draw')&&s.drawn>0){move('7');return;}
  if(id==='9'&&s.summaryReady&&!s.busy&&visible($('#chat-input'))){move('10');return;}
  if(id==='B4'&&$('#site-menu')?.open){next();return;}
  ensureMenu(target);
  const present=visible(target);
  const texts=copy.steps[id==='B3'&&s.loggedIn?'B3signed':id]?.[locale()]||{title:label('library'),description:label('library')};
  let note='';
  if(id==='4')note=label('deepNote');
  if(id==='8')note=label('revealNote');
  if(id==='9')note=label('waiting');
  if(id==='10')note=label('followNote');
  if(welcome&&s.drawn)note=label('preserve');
  if(selector&&!present)note=label('missing');
  const buttons=[];
  const add=(a,text)=>buttons.push([a,text]);
  // One clear exit in the top corner; only the welcome has a skip button.
  if(welcome){add('start',label('start'));add('skip',label('later'));}
  else if(done)add('done',label('free'));
  else if(id==='11'||id==='A11'){
   if(id==='11')add('ai',label('settings'));
   if(visible($('#settings-modal.open')))add('closeSettings',label('closeSettings'));else add('other',label('features'));
   // The top-corner exit is available here too, without a duplicate footer action.
  } else if(id==='A3'){
   add('next',label('chooseAdvanced'));add('advancedSkip',label('skipAdvanced'));
  } else {
   if(history.length)add('back',label('back'));
   if(!mode||!present||id==='9')add('next',id==='8'?label('interpret'):label('next'));
  }
  $('.tour-close').hidden=welcome||done;
  const counter=id==='draw'||id==='7'?label('progress').replace('{drawn}',s.drawn).replace('{required}',s.required).replace('{remaining}',Math.max(0,s.required-s.drawn)):mode&&present?label('action'):'';
  const signature=JSON.stringify([id,locale(),texts,note,buttons,counter]);
  if(signature!==lastText){
   $('#tour-title').textContent=texts.title;$('#tour-description').textContent=texts.description;
   $('#tour-note').textContent=note;$('#tour-note').hidden=!note;
   $('#tour-count').textContent=counter;$('#tour-count').hidden=!counter;
   $('#tour-progress').textContent=welcome||done?'☽ TAROT ORACLE':`${label(branch)} · ${index+1}/${flows[branch].length}`;
   $('.tour-close').setAttribute('aria-label',label('close'));
   const controls=$('.tour-buttons');controls.replaceChildren(...buttons.map(([a,t])=>{const b=document.createElement('button');b.type='button';b.dataset.tourAction=a;b.classList.toggle('tour-secondary',a==='back'||a==='skip'||a==='advancedSkip');b.textContent=t;return b;}));lastText=signature;
  }
  const newTarget=present&&target!==previousTarget;
  place(present?target:null,newTarget);
  if(newTarget)previousTarget=target;
  if(focus)bubble.focus({preventScroll:true});
 }
 // Document coordinates keep the frame attached to the whole target, including
 // content outside the viewport. User scrolling never invokes scrollIntoView.
 function bounds(target){
  const r=target.getBoundingClientRect();
  let box={left:r.left,right:r.right,top:r.top,bottom:r.bottom};
  if(target.id==='fan-stage')for(const el of target.querySelectorAll('.fan-card:not(.drawn)')){
   const card=el.getBoundingClientRect();if(!visible(el))continue;
   box.left=Math.min(box.left,card.left);box.right=Math.max(box.right,card.right);
   box.top=Math.min(box.top,card.top);box.bottom=Math.max(box.bottom,card.bottom);
  }
  return box;
 }
 function place(target,enter=false){
  const vv=window.visualViewport,w=vv?.width||innerWidth,h=vv?.height||innerHeight;
  const sx=scrollX,sy=scrollY,ox=vv?.offsetLeft||0,oy=vv?.offsetTop||0;
  const bw=Math.min(360,w-24);bubble.style.width=bw+'px';bubble.style.maxHeight=Math.max(140,h-40)+'px';
  const bh=Math.min(bubble.scrollHeight,parseFloat(bubble.style.maxHeight));
  let x=sx+ox+(w-bw)/2,y=sy+oy+(h-bh)/2;
  frame.hidden=!target;bubble.dataset.side='none';
  if(target){
   const r=bounds(target),top=r.top+sy-6,bottom=r.bottom+sy+6;
   const left=r.left+sx-6,right=r.right+sx+6;
   Object.assign(frame.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
   x=sx+ox+Math.max(12,Math.min(w-bw-12,r.left-ox));
   // Small targets: prefer a nearby bubble above. Large drawing areas: place it
   // entirely below the cards, so both card rows and the method switch stay usable.
   if(r.bottom-r.top<h*.45&&top-sy-oy>bh+20){y=top-bh-16;bubble.dataset.side='bottom';}
   else {y=bottom+16;bubble.dataset.side='top';}
   if(enter){
    // Scroll only when entering a step. Subsequent wheel/touch scrolling is free.
    if(r.bottom-r.top+bh+40<h){
     const start=Math.min(top,y)-16,end=Math.max(bottom,y+bh)+16;
     window.scrollTo({top:Math.max(0,start-(h-(end-start))/2),behavior:'instant'});
    } else target.scrollIntoView({block:'start',behavior:'instant'});
   }
  }
  Object.assign(bubble.style,{left:x+'px',top:Math.max(12,y)+'px'});
 }

 function schedule(){if(!active||scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
 // Observe layout and asynchronous UI changes, not values/keystrokes in API settings.
 new MutationObserver(records=>{if(records.some(r=>!root?.contains(r.target)))schedule();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','open','lang','disabled']});
 document.addEventListener('click',e=>{if(e.target.closest('#tour-replay')){start();return;}if(!root?.contains(e.target))schedule();});
 document.addEventListener('tarot-state',schedule);
 document.addEventListener('change',schedule);document.addEventListener('focusout',e=>{if(active&&index>=0&&flows[branch][index]?.[0]==='1'&&e.target.id==='q-input'&&!root.contains(e.relatedTarget))next();});
 document.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.stopImmediatePropagation();e.preventDefault();stop('skipped');}},true);
 addEventListener('resize',schedule);addEventListener('scroll',schedule,true);visualViewport?.addEventListener('resize',schedule);visualViewport?.addEventListener('scroll',schedule);
 function updateLabels(){const replay=$('#tour-replay');if(replay)replay.textContent=label('replay');for(const help of [$('#guide-btn'),$('#btn-help')])if(help)help.textContent=label('help');schedule();}
 new MutationObserver(updateLabels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 window.TarotTour={start,refresh:schedule,invite(){updateLabels();let saved;try{saved=JSON.parse(localStorage.getItem(KEY));}catch{}if(!saved&&!active)start();}};

 updateLabels();
 if($('#main')?.style.display==='flex')window.TarotTour.invite();
})();
