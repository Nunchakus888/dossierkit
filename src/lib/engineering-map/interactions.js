/** Progressive enhancement: anchors and native details remain usable without JS. */
const root = document.querySelector('[data-engineering-map]');
if (root) {
  const panels = [...root.querySelectorAll('[data-capability]')];
  const domains = [...root.querySelectorAll('[data-domain]')];
  const links = [...root.querySelectorAll('.node-link')];
  const narrow = matchMedia('(max-width: 700px)');
  const status = document.getElementById('map-live');
  let selected = root.dataset.featured;
  let changingDomain = false;
  const panelFor = id => panels.find(p => p.dataset.capability === id);
  const nodeFor = id => links.find(a => a.dataset.node === id);
  function revealAncestors(el) {
    let parent=el.parentElement;
    while(parent && parent !== root) { if(parent.tagName==='DETAILS') parent.open=true; parent=parent.parentElement; }
  }
  function showNode(id, {scroll=false, focus=false}={}) {
    const panel=panelFor(id); if(!panel) return false;
    selected=id;
    for(const item of panels) { const active=item===panel; item.hidden=!active; if(active) item.open=true; }
    const related=new Set([...panel.querySelectorAll('.relation-list [data-node]')].map(a=>a.dataset.node));
    for(const link of links) {
      const active=link.dataset.node===id;
      link.classList.toggle('is-selected',active);
      link.classList.toggle('is-related',related.has(link.dataset.node));
      if(active) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
    }
    if(scroll) panel.scrollIntoView({block:'start',behavior:'auto'});
    if(focus) panel.querySelector('h3').focus({preventScroll:true});
    if(status) status.textContent=`已展开：${panel.querySelector('h3').textContent}`;
    return true;
  }
  function updateHash(hash) {
    if(location.hash !== hash) { try {history.pushState(null,'',hash);} catch { location.hash=hash; } }
  }
  function applyLocation({scroll=false}={}) {
    let hash; try {hash=decodeURIComponent(location.hash.slice(1));} catch {return;}
    if(hash.startsWith('cap-')) {showNode(hash.slice(4),{scroll,focus:scroll});return;}
    const target=hash?document.getElementById(hash):null;
    if(!target) {showNode(selected);return;}
    if(hash.startsWith('node-')) showNode(hash.slice(5));
    const panel=target.closest('[data-capability]');
    if(panel) showNode(panel.dataset.capability);
    revealAncestors(target);
    if(target.tagName==='DETAILS') target.open=true;
    if(scroll) target.scrollIntoView({block:'start',behavior:'auto'});
  }
  function setDomainLayout() {
    changingDomain=true;
    for(const domain of domains) domain.open=!narrow.matches;
    changingDomain=false;
  }
  setDomainLayout();
  showNode(selected);
  applyLocation({scroll:!!location.hash});
  root.classList.add('is-enhanced');
  for(const domain of domains) domain.addEventListener('toggle',()=>{
    if(changingDomain || !narrow.matches || !domain.open) return;
    changingDomain=true;
    for(const other of domains) if(other!==domain) other.open=false;
    changingDomain=false;
  });
  // Desktop domain headings describe fixed groups; keyboard remains a valid fallback.
  for(const domain of domains) domain.querySelector(':scope > summary').addEventListener('click',event=>{
    if(!narrow.matches) {event.preventDefault();domain.open=true;}
  });
  narrow.addEventListener('change',setDomainLayout);
  root.addEventListener('click',event=>{
    if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link=event.target.closest('a'); if(!link) return;
    if(link.dataset.node) {
      event.preventDefault(); const id=link.dataset.node;
      if(showNode(id,{scroll:true,focus:true})) updateHash(`#cap-${id}`);
    } else if(link.dataset.evidenceTarget) {
      const target=document.getElementById(link.dataset.evidenceTarget); if(!target) return;
      event.preventDefault();target.open=true;revealAncestors(target);updateHash(`#${target.id}`);
      target.scrollIntoView({block:'start',behavior:'auto'});target.querySelector('summary').focus({preventScroll:true});
    } else if(link.dataset.returnNode) {
      const target=nodeFor(link.dataset.returnNode); if(!target) return;
      event.preventDefault();revealAncestors(target);updateHash(`#${target.id}`);
      target.scrollIntoView({block:'center',behavior:'auto'});target.focus({preventScroll:true});
    }
  });
  addEventListener('hashchange',()=>applyLocation({scroll:true}));
  addEventListener('popstate',()=>applyLocation({scroll:true}));
  let printState;
  addEventListener('beforeprint',()=>{
    printState=[...root.querySelectorAll('details')].map(el=>({el,open:el.open,hidden:el.hidden}));
    changingDomain=true;
    for(const {el} of printState) {el.hidden=false;el.open=true;}
  });
  addEventListener('afterprint',()=>{
    for(const {el,open,hidden} of printState || []) {el.open=open;el.hidden=hidden;}
    changingDomain=false;
  });
}
