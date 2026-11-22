import test from 'node:test';
import assert from 'node:assert/strict';
import { findPageStep, findScrollStop } from '../src/work-page-navigation.mjs';

const first = { name: 'Eve' };
const second = { name: 'Lumos' };
const pages = [
  { item: first, cover: 1000, notes: 1600 },
  { item: second, cover: 3500, notes: 4100 },
];

test('one downward gesture on a cover opens its notes', () => {
  assert.deepEqual(findPageStep(1000, 120, pages), { item: first, mode: 'notes', kind: 'switch' });
});
test('one upward gesture at the notes heading returns to its cover', () => {
  assert.deepEqual(findPageStep(1600, -120, pages), { item: first, mode: 'cover', kind: 'switch' });
});
test('reading long notes does not capture normal scrolling in either direction', () => {
  assert.equal(findPageStep(2200, 120, pages), null);
  assert.equal(findPageStep(2200, -120, pages), null);
  assert.equal(findPageStep(1600, 120, pages), null);
});
test('a gesture approaching a cover lands on the cover before opening the notes', () => {
  assert.deepEqual(findPageStep(920, 120, pages), { item: first, mode: 'cover', kind: 'align' });
});
test('scrolling back through notes stops at their heading first', () => {
  assert.deepEqual(findPageStep(1680, -120, pages), { item: first, mode: 'notes', kind: 'align' });
});
test('scrolling above a cover can leave the work normally', () => {
  assert.equal(findPageStep(1000, -120, pages), null);
});
test('small wheel events outside a page boundary remain native', () => {
  assert.equal(findPageStep(700, 2, pages), null);
  assert.equal(findPageStep(2200, 0, pages), null);
});
test('fractional layout pixels do not prevent opening the page', () => {
  assert.equal(findPageStep(1000.5, 2, pages).mode, 'notes');
});
test('a large reverse gesture chooses the nearest notes page', () => {
  assert.deepEqual(findPageStep(4200, -4000, pages), { item: second, mode: 'notes', kind: 'align' });
});
test('scrollbar positions between pages can recover in either direction', () => {
  assert.equal(findPageStep(1250, 120, pages).mode, 'notes');
  assert.equal(findPageStep(1250, -120, pages).mode, 'cover');
});

test('a noncancelable fast scroll cannot pass a cover and its notes at once', () => {
  assert.deepEqual(findScrollStop(700, 2000, pages), { item: first, mode: 'cover', top: 1000 });
});
test('native momentum while reading stops at the next work cover', () => {
  assert.deepEqual(findScrollStop(2200, 4800, pages), { item: second, mode: 'cover', top: 3500 });
});
test('native reverse momentum stops at the nearest notes heading', () => {
  assert.deepEqual(findScrollStop(4200, 700, pages), { item: second, mode: 'notes', top: 4100 });
});
test('native scroll leaking from a stationary cover is returned to that cover', () => {
  assert.deepEqual(findScrollStop(1000, 1300, pages), { item: first, mode: 'cover', top: 1000 });
});
test('the momentum guard allows native scrolling inside long notes', () => {
  assert.equal(findScrollStop(2200, 2500, pages), null);
  assert.equal(findScrollStop(2500, 2200, pages), null);
});
