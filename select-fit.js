// Keep only the ritual and library pickers as wide as their selected label.
(() => {
 const selector='#shuffle-method, [data-deck-picker]';
 function fit(){
  for(const select of document.querySelectorAll(selector)){
   const option=select.selectedOptions[0];if(!option||!select.getClientRects().length)continue;
   const measure=document.createElement('span');
   Object.assign(measure.style,{position:'absolute',visibility:'hidden',whiteSpace:'pre',font:getComputedStyle(select).font,letterSpacing:getComputedStyle(select).letterSpacing});
   measure.textContent=option.textContent;document.body.append(measure);
   select.style.width=Math.ceil(measure.getBoundingClientRect().width+48)+'px';measure.remove();
  }
 }
 let pending=false;
 const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;fit();});};
 document.addEventListener('change',event=>{if(event.target.matches(selector))schedule();});
 addEventListener('resize',schedule);
 new MutationObserver(records=>{if(records.some(r=>r.target.matches?.('html, #ritual-settings, #shuffle-method, [data-deck-picker]')||[...r.addedNodes].some(n=>n.matches?.('#ritual-settings, #shuffle-method'))))schedule();}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['lang','hidden']});
 document.fonts?.ready.then(schedule);schedule();
})();
