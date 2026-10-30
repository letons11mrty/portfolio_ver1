import { gsap } from 'gsap';
const track = document.getElementById('work-timeline');
const sticky = track.querySelector('.timeline-sticky');
const cards = [...track.querySelectorAll('.timeline-card')];
const buttons = [...track.querySelectorAll('[data-work]')];
const year = document.getElementById('timeline-year');
const count = document.getElementById('timeline-count');
const railYear = track.querySelector('.rail-year');
let labelMotion = null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let active = 0, flip = null, scrollTween = null, frame = 0;
let lastWheel = 0, used = false, amount = 0, touch = null;
document.documentElement.classList.add('timeline-ready');
function metrics() {
  const start = track.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(sticky).top);
  const distance = Math.max(1, track.offsetHeight - sticky.offsetHeight);
  return { start, end: start + distance, step: distance / 3 };
}
function positionIndex() { const m = metrics(); return gsap.utils.clamp(0, 3, Math.round((scrollY - m.start) / m.step)); }
function labels(animate = false, direction = 1) {
  if(labelMotion){labelMotion.kill();labelMotion=null;}
  gsap.killTweensOf([railYear,year,count]);
  const update=()=>{
    year.textContent=['2024','2025','2026','2026'][active];
    count.textContent=String(active+1).padStart(2,'0')+' / 04';
  };
  const top=(24+active*15)+'%';
  if(!animate || reduced.matches){
    update();gsap.set(railYear,{top});gsap.set([year,count],{y:0,opacity:1});return;
  }
  labelMotion=gsap.timeline({onComplete:()=>{labelMotion=null;}});
  labelMotion.to(railYear,{top,duration:1.12,ease:'power2.inOut'},0)
    .to([year,count],{y:-20*direction,opacity:0,duration:.26,ease:'power2.in'},.12)
    .call(update,[],.38)
    .set([year,count],{y:22*direction},.38)
    .to([year,count],{y:0,opacity:1,duration:.52,ease:'power3.out'},.38);
}

function access() {
  cards.forEach((card,i) => {card.inert = i !== active;card.setAttribute('aria-hidden',String(i !== active));card.style.pointerEvents = i === active ? 'auto' : 'none';});
  buttons.forEach((button,i) => {if(i === active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
}
function settle() { cards.forEach((card,i) => gsap.set(card,{rotationY:i < active ? -180 : 0,opacity:1,visibility:i < active ? 'hidden' : 'visible'})); }
function move(top, done) {
  if(scrollTween)scrollTween.kill();
  const state = {y:scrollY};
  scrollTween = gsap.to(state,{y:Math.max(0,top),duration:reduced.matches ? 0.01 : 1.12,ease:'power3.inOut',onUpdate:()=>window.scrollTo({top:state.y,behavior:'instant'}),onComplete:()=>{scrollTween=null;if(done)done();}});
}
function turn(index, align = false, instant = false) {
  if(flip)return;
  index = gsap.utils.clamp(0,3,index);
  if(align){const m=metrics();move(m.start + m.step * index);}
  if(index === active)return;
  const previous=active;active=index;access();
  if(instant || reduced.matches){settle();labels();return;}
  const forward=index>previous;
  const range=Array.from({length:Math.abs(index-previous)},(_,i)=>forward ? previous+i : previous-1-i);
  flip=gsap.timeline({onComplete:()=>{flip=null;settle();}});
  range.forEach((i,n)=>{gsap.set(cards[i],{visibility:'visible'});flip.to(cards[i],{rotationY:forward ? -180 : 0,duration:1.12,ease:'power2.inOut',force3D:true},n*.09);});
  labels(true,forward ? 1 : -1);
}
function sync(){frame=0;if(flip || scrollTween)return;const m=metrics();turn(positionIndex(),false,scrollY<m.start-20 || scrollY>m.end+20);}
function schedule(){if(!frame)frame=requestAnimationFrame(sync);}
function inside(){const m=metrics();return scrollY>=m.start-3 && scrollY<=m.end+3;}
function capture(dir){return inside() && !(dir<0 && active===0) && !(dir>0 && active===3);}
window.addEventListener('wheel',e=>{
  if(e.ctrlKey || Math.abs(e.deltaX)>Math.abs(e.deltaY) || !e.deltaY)return;
  const delta=e.deltaY*(e.deltaMode===1 ? 16 : e.deltaMode===2 ? innerHeight : 1);
  const now=performance.now(), fresh=now-lastWheel>210;lastWheel=now;
  if(fresh){used=false;amount=0;}
  if(flip || scrollTween){e.preventDefault();return;}
  const dir=Math.sign(delta),m=metrics();
  if(!capture(dir)){
    if(used && !fresh && inside()){e.preventDefault();return;}
    if(dir>0 && scrollY<m.start-3 && scrollY+delta>=m.start){e.preventDefault();turn(0,false,true);move(m.start);used=true;}
    else if(dir<0 && scrollY>m.end+3 && scrollY+delta<=m.end){e.preventDefault();turn(3,false,true);move(m.end);used=true;}
    return;
  }
  e.preventDefault();if(used)return;amount+=delta;
  if(Math.abs(amount)>=25){used=true;turn(active+Math.sign(amount),true);}
},{passive:false});
window.addEventListener('touchstart',e=>{touch=e.touches.length===1 ? {x:e.touches[0].clientX,y:e.touches[0].clientY,used:false}:null;},{passive:true});
window.addEventListener('touchmove',e=>{
  if(!touch || e.touches.length!==1)return;
  const dy=touch.y-e.touches[0].clientY,dx=touch.x-e.touches[0].clientX;
  if(Math.abs(dy)<Math.abs(dx) || Math.abs(dy)<6)return;
  if(touch.used || flip || scrollTween){e.preventDefault();return;}
  if(capture(Math.sign(dy))){e.preventDefault();if(Math.abs(dy)>45){touch.used=true;turn(active+Math.sign(dy),true);}}
},{passive:false});
for(const event of ['touchend','touchcancel'])window.addEventListener(event,()=>{touch=null;},{passive:true});
window.addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,select,button,a,[contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey)return;
  const dir=['ArrowDown','PageDown',' '].includes(e.key) ? 1 : ['ArrowUp','PageUp'].includes(e.key) ? -1 : 0;
  if(!dir)return;
  if(flip || scrollTween){e.preventDefault();return;}
  if(capture(dir)){e.preventDefault();turn(active+dir,true);}
});
buttons.forEach((button,i)=>button.addEventListener('click',()=>turn(i,true)));
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',e=>{
  if(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)return;
  const hash=link.getAttribute('href'),target=hash==='#' ? document.documentElement : document.getElementById(hash.slice(1));
  if(!target)return;e.preventDefault();
  if(flip){flip.kill();flip=null;settle();labels();}
  const top=hash==='#' ? 0 : target.getBoundingClientRect().top+scrollY-document.querySelector('.topbar').offsetHeight-24;
  move(top,sync);history.pushState(null,'',hash);
}));
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',()=>{if(scrollTween){scrollTween.kill();scrollTween=null;}schedule();});
window.addEventListener('pageshow',schedule);
reduced.addEventListener('change',()=>{if(flip){flip.kill();flip=null;}settle();labels();});
active=positionIndex();settle();access();labels();
