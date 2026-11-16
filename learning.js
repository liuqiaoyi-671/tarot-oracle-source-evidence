// Content and language pairing are static; JavaScript only assists navigation.
(() => {
 const language=document.documentElement.lang.startsWith('zh')?'zh':'en';
 try{localStorage.setItem('tarot-language',language);}catch{}
 const toc=document.querySelector('.toc');
 if(toc&&window.matchMedia('(max-width: 900px)').matches) toc.open=false;
 // Chapter selection enhances the complete static collection; no content is fetched.
 const chapters=[...document.querySelectorAll('[data-chapter]')];
 if(chapters.length){
  const chooseChapter=()=>{
   const requested=location.hash.slice(1),selected=chapters.some(section=>section.id===requested)?requested:'card-meanings';
   for(const section of chapters) section.hidden=section.id!==selected;
   document.querySelectorAll('[data-chapter-link]').forEach(link=>{
    const active=link.dataset.chapterLink===selected;
    link.classList.toggle('active',active);
    if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
   });
   const languageLink=document.querySelector('.language-link');
   if(languageLink){const href=new URL(languageLink.href);href.hash=selected;languageLink.href=href.href;}
  };
  document.querySelectorAll('[data-chapter-link]').forEach(link=>link.addEventListener('click',event=>{
   if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();history.pushState(null,'',link.hash);chooseChapter();
  }));
  addEventListener('hashchange',chooseChapter);
  addEventListener('popstate',chooseChapter);
  chooseChapter();
 }
 const images=[...document.querySelectorAll('[data-deck-card]')];
 if(images.length){
  let catalog;
  const selectedDeck=()=>{try{return localStorage.getItem('tarot-deck-style')||'rws';}catch{return 'rws';}};
  const syncDeck=()=>{
   if(!catalog) return;
   const fallback=catalog.decks.find(item=>item.key==='rws');
   const deck=catalog.decks.find(item=>item.key===selectedDeck())||fallback;
   document.documentElement.dataset.deck=deck.key;
   const grid=document.querySelector('[data-major-grid]');
   if(grid)grid.dataset.deck=deck.key;
   document.querySelectorAll('[data-active-deck-label]').forEach(label=>{label.textContent=deck.name[language];});
   document.querySelectorAll('[data-deck-picker]').forEach(picker=>{picker.value=deck.key;});
   images.forEach(image=>{
    const id=Number(image.dataset.deckCard);
    image.onerror=()=>{image.onerror=null;image.src=fallback.images[id];};
    if(image.getAttribute('src')!==deck.images[id])image.src=deck.images[id];
   });
  };
  fetch('/learning-decks.json').then(response=>{
   if(!response.ok) throw new Error('Deck mapping unavailable');return response.json();
  }).then(data=>{catalog=data;syncDeck();}).catch(()=>{/* Static RWS images and complete articles remain usable. */});
  document.querySelectorAll('[data-deck-picker]').forEach(picker=>picker.addEventListener('change',()=>{
   try{localStorage.setItem('tarot-deck-style',picker.value);}catch{}
   syncDeck();
  }));
  addEventListener('storage',event=>{if(event.key==='tarot-deck-style'||event.key===null)syncDeck();});
  addEventListener('focus',syncDeck);
  addEventListener('pageshow',syncDeck);
 }
 document.querySelectorAll('[data-return-reading]').forEach(link=>{
  link.addEventListener('click',event=>{
   if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey) return;
   try{
    const parent=window.opener;
    if(parent&&!parent.closed&&parent.location.origin===location.origin&&['/','/index.html'].includes(parent.location.pathname)){
     // Only our trusted same-origin reading tab can be focused. Never navigate it.
     event.preventDefault();parent.focus();window.close();
     // If a browser declines to close an auxiliary tab, retain a working fallback.
     setTimeout(()=>{location.href=link.href;},150);
    }
   }catch{/* Direct visits and unavailable opener use the ordinary reading link. */}
  });
 });
})();
