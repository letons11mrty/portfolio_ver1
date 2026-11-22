
const header=document.querySelector('.topbar');
const toggle=header.querySelector('.menu-toggle');
const menu=header.querySelector('.compact-menu');
const hideNavLens=setupNavLens();
let wasCompact=null;
let returnFocus=null;
function close(focus=false){
 hideNavLens();
 header.classList.remove('menu-open');
 toggle.setAttribute('aria-expanded','false');
 toggle.setAttribute('aria-label','メニューを開く');
 menu.inert=true;
 if(focus)toggle.focus({preventScroll:true});
}
function update(){
 const scrolled=window.scrollY>100;
 const compact=scrolled || matchMedia('(max-width: 800px)').matches;
 header.classList.toggle('is-scrolled',scrolled);
 header.querySelector('.logo').inert=scrolled;
 if(compact===wasCompact)return;
 wasCompact=compact;
 if(compact && header.querySelector('.mainnav').contains(document.activeElement))returnFocus=document.activeElement;
 header.classList.toggle('is-compact',compact);
 header.querySelector('.mainnav').inert=compact;

 toggle.inert=!compact;
 if(!compact){const restore=document.activeElement===toggle || menu.contains(document.activeElement);close();if(restore)header.querySelector('.logo').focus({preventScroll:true});}
 else if(returnFocus){toggle.focus({preventScroll:true});returnFocus=null;}
}
toggle.addEventListener('click',()=>{
 const opening=toggle.getAttribute('aria-expanded')!=='true';
 if(!opening){close();return;}
 header.classList.add('menu-open');menu.inert=false;
 toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','メニューを閉じる');
});
menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>close(true)));
document.addEventListener('keydown',e=>{if(e.key==='Escape' && toggle.getAttribute('aria-expanded')==='true')close(true);});
document.addEventListener('click',e=>{if(!header.contains(e.target))close();});
document.addEventListener('focusin',e=>{if(!header.contains(e.target))close();});
window.addEventListener('scroll',update,{passive:true});
window.addEventListener('pageshow',update);
window.addEventListener('resize',update);
toggle.inert=true;update();

function setupNavLens(){
 const viewport=document.createElement('div');
 const lens=document.createElement('div');
 const scene=document.createElement('div');
 viewport.className='nav-lens-viewport';
 lens.id='nav-tooltip';
 lens.className='nav-lens';
 lens.setAttribute('role','tooltip');
 scene.className='nav-lens-scene';
 scene.setAttribute('aria-hidden','true');
 lens.append(scene);
 lens.hidden=true;
 viewport.append(lens);
 document.body.append(viewport);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const zoom=1.45;
 let activeLink=null, frame=0;
 let current={x:0,y:0}, target={x:0,y:0};
 const hide=()=>{
  if(activeLink){
   activeLink.removeAttribute('aria-describedby');
   activeLink.classList.remove('nav-lens-active');
  }
  cancelAnimationFrame(frame);
  frame=0;
  activeLink=null;
  lens.hidden=true;
  lens.classList.remove('is-visible');
 };
 const draw=()=>{
  lens.style.left=current.x+'px';
  lens.style.top=current.y+'px';
  // Magnify a stationary Japanese nav layer around the optical center.
  // The words retain their source positions instead of following the cursor.
  const radius=lens.clientWidth/2;
  scene.style.transform=`translate3d(${radius-current.x*zoom}px,${radius-current.y*zoom}px,0) scale(${zoom})`;
 };
 const animate=()=>{
  frame=0;
  if(!activeLink)return;
  const distance=Math.hypot(target.x-current.x,target.y-current.y);
  if(reduced.matches || distance<.2)current={...target};
  else {
   current.x+=(target.x-current.x)*.24;
   current.y+=(target.y-current.y)*.24;
  }
  draw();
  lens.classList.add('is-visible');
  if(distance>=.2 && !reduced.matches)frame=requestAnimationFrame(animate);
 };
 const position=(x,y,instant=false)=>{
  target={x,y};
  if(instant || reduced.matches){current={...target};draw();}
  if(!frame)frame=requestAnimationFrame(animate);
 };
 const show=(link,x,y,pointer=false)=>{
  hide();
  activeLink=link;
  lens.setAttribute('aria-label',link.dataset.navLabel);
  scene.replaceChildren();
  link.closest('nav').querySelectorAll('[data-nav-label]').forEach(sourceLink=>{
   const range=document.createRange();
   range.selectNodeContents(sourceLink);
   const rect=range.getBoundingClientRect();
   const label=document.createElement('span');
   label.className='nav-lens-label';
   label.classList.toggle('is-active',sourceLink===link);
   label.textContent=sourceLink.dataset.navLabel;
   label.dataset.source=sourceLink.hash;
   label.style.left=rect.left+'px';
   label.style.top=(rect.top+rect.height/2)+'px';
   label.style.fontSize=getComputedStyle(sourceLink).fontSize;
   scene.append(label);
  });
  lens.hidden=false;
  if(pointer)link.classList.add('nav-lens-active');
  link.setAttribute('aria-describedby',lens.id);
  position(x,y,true);
 };
 header.querySelectorAll('[data-nav-label]').forEach(link=>{
  link.addEventListener('pointerenter',event=>{
   if(event.pointerType==='touch' || !matchMedia('(hover: hover)').matches)return;
   show(link,event.clientX,event.clientY,true);
  });
  link.addEventListener('pointermove',event=>{
   if(activeLink===link && event.pointerType!=='touch')position(event.clientX,event.clientY);
  });
  link.addEventListener('pointerleave',()=>{if(activeLink===link)hide();});
  link.addEventListener('focus',()=>{
   if(!link.matches(':focus-visible'))return;
   const range=document.createRange();
   range.selectNodeContents(link);
   const rect=range.getBoundingClientRect();
   show(link,rect.left+rect.width/2,rect.top+rect.height/2);
  });
  link.addEventListener('blur',()=>{if(activeLink===link)hide();});
  link.addEventListener('pointerdown',hide);
  link.addEventListener('click',hide);
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
 window.addEventListener('scroll',hide,{passive:true});
 window.addEventListener('resize',hide);
 window.addEventListener('blur',hide);
 return hide;
}
