import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { findPageStep, findScrollStop } from '../src/work-page-navigation.mjs';

function setup() {
  const listeners = new Map();
  const classes = new Set();
  const frames = new Map();
  const timers = new Map();
  let id = 0;
  let time = 0;
  class Element { closest() { return null; } }
  const media = { matches: false, addEventListener() {} };
  const window = {
    scrollY: 300, matchMedia: () => media,
    scrollTo: ({ top }) => { window.scrollY = top; },
    addEventListener: (name, handler) => listeners.set(name, handler),
  };
  const document = {
    querySelector: () => ({ offsetHeight: 72 }), querySelectorAll: () => [],
    addEventListener: (name, handler) => listeners.set(`document:${name}`, handler),
    documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
  };
  const context = vm.createContext({
    window, document, Element, findPageStep, findScrollStop,
    innerHeight: 800, performance: { now: () => time },
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: key => frames.delete(key),
    setTimeout: callback => { timers.set(++id, callback); return id; },
    clearTimeout: key => timers.delete(key),
  });
  const code = readFileSync(new URL('../src/work-page-switch.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
  vm.runInContext(code, context);
  const focusTarget = { hasAttribute: () => true, focus() {} };
  const item = {
    work: focusTarget,
    opening: { getBoundingClientRect: () => ({ top: 1096 - window.scrollY }) },
    notes: { ...focusTarget, getBoundingClientRect: () => ({ top: 1696 - window.scrollY }) },
  };
  return {
    context, window, listeners, classes, media, item, Element,
    advance: milliseconds => {
      time += milliseconds;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(time));
    },
    settle: () => [...timers.values()].forEach(callback => callback()),
  };
}

test('native scroll cannot move the document during page alignment or its momentum hold', () => {
  const env = setup();
  env.context.alignPage(env.item, 'cover');
  assert.equal(env.classes.has('is-page-moving'), true);
  env.window.scrollY = 5000;
  env.listeners.get('scroll')();
  assert.equal(env.window.scrollY, 300);
  env.advance(650);
  assert.equal(env.window.scrollY, 1000);
  env.window.scrollY = 7000;
  env.listeners.get('scroll')();
  assert.equal(env.window.scrollY, 1000);
  env.settle();
  assert.equal(env.classes.has('is-page-moving'), false);
  env.window.scrollY = 1200;
  env.listeners.get('scroll')();
  assert.equal(env.window.scrollY, 1200);
});

test('reduced-motion page changes also stop residual momentum', () => {
  const env = setup();
  env.media.matches = true;
  env.context.switchPage(env.item, 'notes');
  assert.equal(env.window.scrollY, 1600);
  env.window.scrollY = 8000;
  env.listeners.get('scroll')();
  assert.equal(env.window.scrollY, 1600);
  env.settle();
  assert.equal(env.classes.has('is-page-moving'), false);
});

test('an explicit navigation link releases the momentum hold', () => {
  const env = setup();
  env.context.alignPage(env.item, 'cover');
  env.advance(650);
  const link = { closest: () => null };
  const target = new env.Element();
  target.closest = () => link;
  env.listeners.get('document:click')({ target });
  assert.equal(env.classes.has('is-page-moving'), false);
});
