
const header=document.querySelector('.topbar');
const toggle=header.querySelector('.menu-toggle');
const menu=header.querySelector('.compact-menu');
let wasCompact=false;
let returnFocus=null;
function close(focus=false){
 header.classList.remove('menu-open');
 toggle.setAttribute('aria-expanded','false');
 toggle.setAttribute('aria-label','メニューを開く');
 menu.inert=true;
 if(focus)toggle.focus({preventScroll:true});
}
function update(){
 const compact=window.scrollY>100;
 if(compact===wasCompact)return;
 wasCompact=compact;
 if(compact && header.querySelector('.mainnav').contains(document.activeElement))returnFocus=document.activeElement;
 header.classList.toggle('is-compact',compact);
 header.querySelector('.mainnav').inert=compact;
 header.querySelector('.logo').inert=compact;
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
toggle.inert=true;update();
