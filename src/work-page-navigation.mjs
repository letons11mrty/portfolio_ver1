// Only cover/notes boundaries capture a gesture; long notes scroll normally.
export function findPageStep(position, delta, pages, tolerance = 6) {
  if (!delta) return null;
  const forward = delta > 0;
  const ordered = forward ? pages : [...pages].reverse();
  for (const page of ordered) {
    const between = position > page.cover + tolerance && position < page.notes - tolerance;
    if (forward && (Math.abs(position - page.cover) <= tolerance || between)) {
      return { item: page.item, mode: 'notes', kind: 'switch' };
    }
    if (!forward && (Math.abs(position - page.notes) <= tolerance || between)) {
      return { item: page.item, mode: 'cover', kind: 'switch' };
    }
    if (forward && position < page.cover - tolerance && position + delta >= page.cover) {
      return { item: page.item, mode: 'cover', kind: 'align' };
    }
    if (!forward && position > page.notes + tolerance && position + delta <= page.notes) {
      return { item: page.item, mode: 'notes', kind: 'align' };
    }
  }
  return null;
}

// Some wheel transactions are not cancelable after native scrolling has started.
// Catch their actual scroll position at the first boundary instead of skipping it.
export function findScrollStop(from, to, pages) {
  const step = findPageStep(from, to - from, pages);
  if (!step) return null;
  const mode = step.kind === 'switch' ? (step.mode === 'notes' ? 'cover' : 'notes') : step.mode;
  const page = pages.find(page => page.item === step.item);
  return { item: step.item, mode, top: page[mode] };
}
