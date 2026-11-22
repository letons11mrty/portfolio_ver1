import { findPageStep, findScrollStop } from './work-page-navigation.mjs';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const header = document.querySelector('.w-head');
const works = [...document.querySelectorAll('.w-work')].map(work => ({
  work, title: work.querySelector('.w-work-title'),
  opening: work.querySelector('.w-work-opening'), notes: work.querySelector('.w-work-notes'),
}));
let motion = null;
let lastWheel = 0;
let gestureUsed = false;
let wheelAmount = 0;
let touch = null;
let expectedY = window.scrollY;
let restingY = null;
let settleTimer = 0;
let nativeInputUntil = 0;
const gesturePause = 320;

const offset = () => header.offsetHeight + 24;
const panel = (item, mode) => mode === 'cover' ? item.opening : item.notes;
const destination = (item, mode) => Math.max(0, panel(item, mode).getBoundingClientRect().top + window.scrollY - offset());
const instantScroll = top => {
  expectedY = top;
  window.scrollTo({ top, behavior: 'instant' });
  expectedY = window.scrollY;
};
const interactive = target => target instanceof Element && target.closest('input, textarea, select, video, [contenteditable="true"]');

function pagePositions() {
  return works.map(item => ({
    item, cover: destination(item, 'cover'), notes: destination(item, 'notes'),
  }));
}

function nextStep(delta) {
  return findPageStep(window.scrollY, delta, pagePositions());
}

function releaseScroll() {
  clearTimeout(settleTimer);
  restingY = null;
  if (!motion) document.documentElement.classList.remove('is-page-moving');
}

function lockScroll() {
  clearTimeout(settleTimer);
  restingY = null;
  document.documentElement.classList.add('is-page-moving');
  expectedY = window.scrollY;
}

function holdScroll(top) {
  clearTimeout(settleTimer);
  restingY = top;
  document.documentElement.classList.add('is-page-moving');
  instantScroll(top);
  settleTimer = setTimeout(releaseScroll, gesturePause);
}

// Only the banner/notes content belongs to the two sliding screens.
function snapshot(item, mode) {
  const screen = document.createElement('div');
  screen.className = 'w-page-screen';
  const root = document.createElement('div');
  root.className = item.work.className;
  Object.assign(root.style, {
    display: 'block', position: 'absolute', inset: '0', padding: '0',
    border: '0', margin: '0', width: '100%', height: '100%',
  });
  screen.append(root);
  const source = panel(item, mode);
  const rect = source.getBoundingClientRect();
  const copy = source.cloneNode(true);
  Object.assign(copy.style, {
    position: 'absolute', top: `${rect.top - header.offsetHeight}px`,
    left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: '0',
  });
  if (mode === 'notes') {
    const layout = getComputedStyle(source);
    copy.style.gridTemplateColumns = layout.gridTemplateColumns;
    copy.style.columnGap = layout.columnGap;
    const media = source.querySelector('.w-work-media');
    const mediaRect = media.getBoundingClientRect();
    Object.assign(copy.querySelector('.w-work-media').style, {
      // Absolute grid children otherwise use their assigned grid area as origin.
      gridArea: 'auto', position: 'absolute', top: `${mediaRect.top - rect.top}px`,
      left: `${mediaRect.left - rect.left}px`, width: `${mediaRect.width}px`,
      height: `${mediaRect.height}px`, margin: '0',
    });
  }
  root.append(copy);
  root.querySelectorAll('.w-reveal').forEach(element => {
    element.classList.add('is-in');
    element.style.transition = 'none';
  });
  root.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
  root.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  return screen;
}

function stationaryTitle(item) {
  const rect = item.title.getBoundingClientRect();
  const title = item.title.cloneNode(true);
  title.classList.add('w-page-fixed-title');
  Object.assign(title.style, {
    gridArea: 'auto', position: 'absolute',
    top: `${rect.top - header.offsetHeight}px`, left: `${rect.left}px`,
    width: `${rect.width}px`, height: `${rect.height}px`, margin: '0',
  });
  return title;
}

function focusPage(item, mode) {
  const target = mode === 'notes' ? item.notes : item.work;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

function switchPage(item, mode, updateHistory = false) {
  if (motion) return;
  const from = mode === 'notes' ? 'cover' : 'notes';
  const top = destination(item, mode);
  const direction = mode === 'notes' ? 1 : -1;
  const finishNavigation = () => {
    focusPage(item, mode);
    if (updateHistory) {
      const hash = `#${mode === 'notes' ? item.notes.id : item.work.id}`;
      if (location.hash !== hash) history.pushState(null, '', hash);
    }
  };
  if (reducedMotion.matches || !Element.prototype.animate) {
    holdScroll(top);
    finishNavigation();
    return;
  }
  lockScroll();
  const overlay = document.createElement('div');
  overlay.className = 'w-page-transition';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true;
  const outgoing = snapshot(item, from);
  overlay.append(outgoing, stationaryTitle(item));
  document.body.append(overlay);
  item.notes.querySelectorAll('.w-reveal').forEach(element => {
    element.style.transition = 'none';
    element.classList.add('is-in');
  });
  instantScroll(top);
  const incoming = snapshot(item, mode);
  overlay.append(incoming);
  const options = { duration: 1050, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'both' };
  const animations = [
    outgoing.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-100 * direction}%)` }], options),
    incoming.animate([{ transform: `translateY(${100 * direction}%)` }, { transform: 'translateY(0)' }], options),
  ];
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    instantScroll(destination(item, mode));
    overlay.remove();
    animations.forEach(animation => animation.cancel());
    motion = null;
    holdScroll(destination(item, mode));
    finishNavigation();
  };
  motion = { finish };
  Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
}

function alignPage(item, mode) {
  if (motion) return;
  const from = window.scrollY;
  const to = destination(item, mode);
  if (reducedMotion.matches) { holdScroll(to); return; }
  lockScroll();
  let frame;
  let finished = false;
  const start = performance.now();
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    instantScroll(destination(item, mode));
    motion = null;
    holdScroll(destination(item, mode));
  };
  motion = { finish };
  function step(now) {
    const progress = Math.min(1, (now - start) / 650);
    const eased = 1 - (1 - progress) ** 3;
    instantScroll(from + (to - from) * eased);
    if (progress < 1) frame = requestAnimationFrame(step);
    else finish();
  }
  frame = requestAnimationFrame(step);
}

function runStep(step) {
  if (step.kind === 'switch') switchPage(step.item, step.mode);
  else alignPage(step.item, step.mode);
}

window.addEventListener('wheel', event => {
  if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
  const now = performance.now();
  const fresh = now - lastWheel > gesturePause;
  nativeInputUntil = now + gesturePause;
  lastWheel = now;
  if (motion) { event.preventDefault(); return; }
  if (restingY !== null && !fresh) {
    event.preventDefault();
    holdScroll(restingY);
    return;
  }
  if (fresh) { releaseScroll(); gestureUsed = false; wheelAmount = 0; }
  if (gestureUsed) { event.preventDefault(); return; }
  if (interactive(event.target)) return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
  const step = nextStep(delta);
  if (!step) { wheelAmount = 0; return; }
  event.preventDefault();
  if (Math.sign(wheelAmount) !== Math.sign(delta)) wheelAmount = 0;
  wheelAmount += delta;
  if (Math.abs(wheelAmount) >= 25) { gestureUsed = true; runStep(step); }
}, { passive: false });

window.addEventListener('touchstart', event => {
  if (!motion) releaseScroll();
  touch = event.touches.length === 1 && !interactive(event.target)
    ? { x: event.touches[0].clientX, y: event.touches[0].clientY, used: false } : null;
}, { passive: true });
window.addEventListener('touchmove', event => {
  if (!touch || event.touches.length !== 1) return;
  nativeInputUntil = performance.now() + gesturePause;
  const dy = touch.y - event.touches[0].clientY;
  const dx = touch.x - event.touches[0].clientX;
  if (Math.abs(dy) < Math.abs(dx) || Math.abs(dy) < 6) return;
  if (motion || touch.used) { event.preventDefault(); return; }
  const step = nextStep(dy);
  if (!step) return;
  event.preventDefault();
  if (Math.abs(dy) >= 45) { touch.used = true; runStep(step); }
}, { passive: false });
for (const type of ['touchend', 'touchcancel']) window.addEventListener(type, () => {
  touch = null;
  if (restingY !== null) holdScroll(restingY);
}, { passive: true });

window.addEventListener('scroll', () => {
  const actualY = window.scrollY;
  if (motion || restingY !== null) {
    const lockedY = restingY ?? expectedY;
    if (Math.abs(actualY - lockedY) > 1) instantScroll(lockedY);
    return;
  }
  const previousY = expectedY;
  expectedY = actualY;
  if (performance.now() > nativeInputUntil || Math.abs(actualY - previousY) < 1) return;
  const stop = findScrollStop(previousY, actualY, pagePositions());
  if (stop) {
    gestureUsed = true;
    wheelAmount = 0;
    holdScroll(stop.top);
  }
}, { passive: true });

window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && motion) { motion.finish(); return; }
  if (event.ctrlKey || event.metaKey || event.altKey || interactive(event.target) || (event.target instanceof Element && event.target.closest('a, button, summary'))) return;
  const direction = ['ArrowDown', 'PageDown', ' '].includes(event.key) ? (event.key === ' ' && event.shiftKey ? -1 : 1)
    : ['ArrowUp', 'PageUp'].includes(event.key) ? -1 : 0;
  if (!direction) return;
  if (motion) { event.preventDefault(); return; }
  releaseScroll();
  const step = nextStep(direction * innerHeight * .85);
  if (step) { event.preventDefault(); runStep(step); }
});

works.forEach(item => {
  item.opening.querySelectorAll('a[href^="#notes-"]').forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    switchPage(item, 'notes', true);
  }));
  item.notes.querySelector('.w-notes-heading a').addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    switchPage(item, 'cover', true);
  });
});
document.addEventListener('click', event => {
  const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
  if (!link || link.closest('.w-work-opening, .w-notes-heading')) return;
  if (motion) motion.finish();
  releaseScroll();
  nativeInputUntil = 0;
}, { capture: true });
for (const type of ['popstate', 'hashchange']) window.addEventListener(type, () => {
  if (motion) motion.finish();
  releaseScroll();
  nativeInputUntil = 0;
});
window.addEventListener('resize', () => { if (motion) motion.finish(); });
reducedMotion.addEventListener('change', () => { if (motion) motion.finish(); });
