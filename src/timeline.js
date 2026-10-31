import { gsap } from 'gsap';
const track = document.getElementById('work-timeline');
const sticky = track.querySelector('.timeline-sticky');
const cards = [...track.querySelectorAll('.timeline-card')];
const buttons = [...track.querySelectorAll('[data-work]')];
const year = document.getElementById('timeline-year');
const count = document.getElementById('timeline-count');
const lastIndex = cards.length - 1;
const dates = cards.map(card => card.dataset.date);
const railYear = track.querySelector('.rail-year');
let labelMotion = null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const compactLayout = matchMedia('(max-width: 1023px)');
const shortScreen = matchMedia('(max-width: 800px) and (max-height: 700px), (max-width: 1023px) and (max-height: 560px)');
let active = 0, flip = null, scrollTween = null, frame = 0;
let lastWheel = 0, used = false, amount = 0, touch = null;
document.documentElement.classList.add('timeline-ready');
function metrics() {
  const start = track.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(sticky).top);
  const distance = Math.max(1, track.offsetHeight - sticky.offsetHeight);
  return { start, end: start + distance, step: distance / Math.max(1,lastIndex) };
}
function positionIndex() { const m = metrics(); return gsap.utils.clamp(0, lastIndex, Math.round((scrollY - m.start) / m.step)); }
function labels(animate = false, direction = 1) {
  if(labelMotion){labelMotion.kill();labelMotion=null;}
  gsap.killTweensOf([railYear,year,count]);
  const update=()=>{
    year.textContent=dates[active];
    count.textContent=String(active+1).padStart(2,'0')+' / '+String(cards.length).padStart(2,'0');
  };
  const top=(24+active*45/Math.max(1,lastIndex))+'%';
  if(!animate || reduced.matches){
    update();gsap.set(railYear,{top});gsap.set([year,count],{y:0,opacity:1});return;
  }
  labelMotion=gsap.timeline({onComplete:()=>{labelMotion=null;}});
  labelMotion.to(railYear,{top,duration:1.05,ease:'power2.inOut'},0)
    .to([year,count],{y:-20*direction,opacity:0,duration:.26,ease:'power2.in'},.12)
    .call(update,[],.38)
    .set([year,count],{y:22*direction},.38)
    .to([year,count],{y:0,opacity:1,duration:.52,ease:'power3.out'},.38);
}

function access() {
  cards.forEach((card,i) => {const shown=shortScreen.matches || i===active;card.inert=!shown;card.setAttribute('aria-hidden',String(!shown));card.style.pointerEvents=shown?'auto':'none';});
  buttons.forEach((button,i) => {if(i === active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
}
function settle() { cards.forEach((card,i) => gsap.set(card,{rotationY:0,yPercent:0,opacity:1,zIndex:i===active ? 2 : 0,visibility:shortScreen.matches || i===active ? 'visible' : 'hidden'})); }
function move(top, done) {
  if(scrollTween)scrollTween.kill();
  const state = {y:scrollY};
  scrollTween = gsap.to(state,{y:Math.max(0,top),duration:reduced.matches ? 0.01 : 1.05,ease:'power3.inOut',onUpdate:()=>window.scrollTo({top:state.y,behavior:'instant'}),onComplete:()=>{scrollTween=null;if(done)done();}});
}
// Overlap the outgoing screen and the next section so there is no blank fade.
function fadeIntro(top, fromSection = null, toSection = null) {
  if (reduced.matches) { move(top); return; }
  if (scrollTween) scrollTween.kill();
  const forward = top > scrollY;
  const outgoing = fromSection || document.querySelector(forward ? '.hero' : '#works');
  const incoming = toSection || document.querySelector(forward ? '#works' : '.hero');
  // About and the content visible below it enter as one screen.
  const incomingContent = incoming.id === 'about'
    ? [incoming, ...Array.from(incoming.parentElement.children).slice(Array.from(incoming.parentElement.children).indexOf(incoming) + 1)]
    : [incoming];
  const revealing = incomingContent.flatMap(section => [...section.querySelectorAll('.scroll-reveal')]);
  if (incoming.id === 'about') {
    // Avoid stacking a second child reveal on the shared screen transition.
    revealing.forEach(element => element.classList.add('is-revealed'));
  }
  const rect = outgoing.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true;
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', overflow: 'hidden', pointerEvents: 'none', zIndex: '20'
  });
  const snapshot = outgoing.cloneNode(true);
  snapshot.removeAttribute('id');
  snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  Object.assign(snapshot.style, {
    position: 'absolute', top: rect.top + 'px', left: rect.left + 'px',
    width: rect.width + 'px', height: rect.height + 'px', margin: '0', boxSizing: 'border-box'
  });
  // Preserve the sticky work panel's current position inside the temporary snapshot.
  const sourceSticky = outgoing.querySelector('.timeline-sticky');
  if (sourceSticky) {
    const panel = snapshot.querySelector('.timeline-sticky');
    panel.style.position = 'absolute';
    panel.style.top = (sourceSticky.getBoundingClientRect().top - outgoing.querySelector('.timeline-track').getBoundingClientRect().top) + 'px';
    panel.style.width = sourceSticky.getBoundingClientRect().width + 'px';
  }
  overlay.append(snapshot);
  document.body.append(overlay);
  const finish = () => {
    overlay.remove();
    gsap.set(incomingContent, { clearProps: 'opacity,transform' });
    scrollTween = null;
    schedule();
  };
  gsap.set(incomingContent, { opacity: 0, y: forward ? 48 : -48 });
  window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  scrollTween = gsap.timeline({ onComplete: finish, onInterrupt: finish })
    .to(overlay, { opacity: 0, y: forward ? -48 : 48, duration: .95, ease: 'power2.inOut' }, 0)
    .to(incomingContent, { opacity: 1, y: 0, duration: .95, ease: 'power2.inOut' }, 0);
}
function turn(index, align = false, instant = false) {
  if(flip)return;
  index = gsap.utils.clamp(0,lastIndex,index);
  if(align){const m=metrics();move(m.start + m.step * index);}
  if(index === active)return;
  const previous=active;active=index;access();
  if(instant || reduced.matches){settle();labels();return;}
  const direction=index>previous ? 1 : -1;
  const outgoing=cards[previous],incoming=cards[index];
  gsap.set(outgoing,{visibility:'visible',zIndex:2,yPercent:0,rotationY:0});
  gsap.set(incoming,{visibility:'visible',zIndex:3,yPercent:100*direction,rotationY:0});
  flip=gsap.timeline({onComplete:()=>{flip=null;settle();}})
    .to(outgoing,{yPercent:-100*direction,duration:1.05,ease:'power3.inOut'},0)
    .to(incoming,{yPercent:0,duration:1.05,ease:'power3.inOut'},0);
  labels(true,direction);
}
function sync(){frame=0;if(shortScreen.matches){settle();access();return;}if(flip || scrollTween)return;const m=metrics();turn(positionIndex(),false,scrollY<m.start-20 || scrollY>m.end+20);}
function schedule(){if(!frame)frame=requestAnimationFrame(sync);}
function inside(){const m=metrics();return scrollY>=m.start-3 && scrollY<=m.end+3;}
function capture(dir){return !shortScreen.matches && inside() && !(dir<0 && active===0) && !(dir>0 && active===lastIndex);}
// One gesture moves between the opening profile and the first work screen.
function introDestination(dir) {
  if(compactLayout.matches)return null;
  const m = metrics();
  const hero = document.querySelector('.hero');
  if (!hero || document.querySelector('.topbar.menu-open')) return null;
  const heroBottom = hero.getBoundingClientRect().bottom;
  const profileFits = hero.offsetHeight <= innerHeight * 1.25;
  const works = document.getElementById('works');
  const worksTop = Math.max(0, works.getBoundingClientRect().top + scrollY - 24);
  if (dir > 0 && scrollY < worksTop - 3 && (profileFits || heroBottom <= innerHeight + 30)) return worksTop;
  if (dir < 0 && active === 0 && scrollY > 3 && scrollY <= m.start + 3) return 0;
  return null;
}

// Connect the final work and About with the same overlapping screen transition.
function aboutDestination(dir) {
  if(compactLayout.matches)return null;
  const about = document.getElementById('about');
  if (!about || document.querySelector('.topbar.menu-open')) return null;
  const m = metrics();
  const top = Math.max(0, about.getBoundingClientRect().top + scrollY - 24);
  const works = document.getElementById('works');
  if (dir > 0 && active === lastIndex && scrollY >= m.end - 3 && scrollY < top - 3)
    return { top, from: works, to: about };
  if (dir < 0 && scrollY >= m.end + 4 && scrollY <= top + 40)
    return { top: m.end, from: about, to: works };
  return null;
}
window.addEventListener('wheel',e=>{
  if(shortScreen.matches || document.querySelector('.topbar.menu-open'))return;
  if(e.ctrlKey || Math.abs(e.deltaX)>Math.abs(e.deltaY) || !e.deltaY)return;
  const delta=e.deltaY*(e.deltaMode===1 ? 16 : e.deltaMode===2 ? innerHeight : 1);
  const now=performance.now(), fresh=now-lastWheel>210;lastWheel=now;
  if(fresh){used=false;amount=0;}
  if(flip || scrollTween){e.preventDefault();return;}
  const dir=Math.sign(delta),m=metrics();
  const boundary=aboutDestination(dir);
  if(boundary){e.preventDefault();if(used)return;amount+=delta;if(Math.abs(amount)>=25){used=true;fadeIntro(boundary.top,boundary.from,boundary.to);}return;}
  const introTop=introDestination(dir);
  if(introTop!==null){
    e.preventDefault();if(used)return;amount+=delta;
    if(Math.abs(amount)>=25){used=true;turn(0,false,true);fadeIntro(introTop);}
    return;
  }
  if(!capture(dir)){
    if(used && !fresh && inside()){e.preventDefault();return;}
    if(dir>0 && scrollY<m.start-3 && scrollY+delta>=m.start){e.preventDefault();turn(0,false,true);move(m.start);used=true;}
    else if(dir<0 && scrollY>m.end+3 && scrollY+delta<=m.end){e.preventDefault();turn(lastIndex,false,true);move(m.end);used=true;}
    return;
  }
  e.preventDefault();if(used)return;amount+=delta;
  if(Math.abs(amount)>=25){used=true;turn(active+Math.sign(amount),true);}
},{passive:false});
window.addEventListener('touchstart',e=>{touch=e.touches.length===1 ? {x:e.touches[0].clientX,y:e.touches[0].clientY,used:false}:null;},{passive:true});
window.addEventListener('touchmove',e=>{
  if(shortScreen.matches || document.querySelector('.topbar.menu-open') || !touch || e.touches.length!==1)return;
  const dy=touch.y-e.touches[0].clientY,dx=touch.x-e.touches[0].clientX;
  if(Math.abs(dy)<Math.abs(dx) || Math.abs(dy)<6)return;
  if(touch.used || flip || scrollTween){e.preventDefault();return;}
  const boundary=aboutDestination(Math.sign(dy));
  if(boundary){e.preventDefault();if(Math.abs(dy)>45){touch.used=true;fadeIntro(boundary.top,boundary.from,boundary.to);}return;}
  const introTop=introDestination(Math.sign(dy));
  if(introTop!==null){e.preventDefault();if(Math.abs(dy)>45){touch.used=true;turn(0,false,true);fadeIntro(introTop);}return;}
  if(capture(Math.sign(dy))){e.preventDefault();if(Math.abs(dy)>45){touch.used=true;turn(active+Math.sign(dy),true);}}
},{passive:false});
for(const event of ['touchend','touchcancel'])window.addEventListener(event,()=>{touch=null;},{passive:true});
window.addEventListener('keydown',e=>{
  if(shortScreen.matches)return;
  if(e.target.closest('input,textarea,select,button,a,[contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey)return;
  const dir=['ArrowDown','PageDown',' '].includes(e.key) ? 1 : ['ArrowUp','PageUp'].includes(e.key) ? -1 : 0;
  if(!dir)return;
  if(flip || scrollTween){e.preventDefault();return;}
  const boundary=aboutDestination(dir);
  if(boundary){e.preventDefault();fadeIntro(boundary.top,boundary.from,boundary.to);return;}
  const introTop=introDestination(dir);
  if(introTop!==null){e.preventDefault();turn(0,false,true);fadeIntro(introTop);return;}
  if(capture(dir)){e.preventDefault();turn(active+dir,true);}
});
buttons.forEach((button,i)=>button.addEventListener('click',()=>turn(i,true)));
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',e=>{
  if(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)return;
  const hash=link.getAttribute('href'),target=hash==='#' ? document.documentElement : document.getElementById(hash.slice(1));
  if(!target)return;e.preventDefault();
  if(shortScreen.matches && link.matches('[data-work]'))return;
  if(flip){flip.kill();flip=null;settle();labels();}
  const top=hash==='#' ? 0 : target.getBoundingClientRect().top+scrollY-document.querySelector('.topbar').offsetHeight-24;
  move(top,sync);history.pushState(null,'',hash);
}));
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',()=>{if(scrollTween){scrollTween.kill();scrollTween=null;}schedule();});
shortScreen.addEventListener('change',()=>{if(flip){flip.kill();flip=null;}if(scrollTween){scrollTween.kill();scrollTween=null;}settle();access();labels();schedule();});
window.addEventListener('pageshow',schedule);
reduced.addEventListener('change',()=>{if(flip){flip.kill();flip=null;}settle();labels();});
active=positionIndex();settle();access();labels();
