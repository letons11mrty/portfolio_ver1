// Reveal each section as it enters the viewport; timeline slides keep their own transforms.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const targets = [...document.querySelectorAll([
  '.hero-topline', '.hero-name', '.hero-art', '.hero-bottom',
  '.details > .section-heading', '.project-overview > *', '.project-story > *', '.project-detail > .project-technologies',
  '.contact > *'
].join(', '))];

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  for (const target of targets) {
    target.classList.add('scroll-reveal');
    // A small stagger gives the title and image a natural rhythm.
    const delay = target.matches('.hero-art, .about-grid > :nth-child(2), .project-detail > :nth-child(2)') ? 110 : 0;
    target.style.setProperty('--reveal-delay', delay + 'ms');
    observer.observe(target);
  }

  const revealAll = () => {
    for (const target of targets) target.classList.add('is-revealed');
    observer.disconnect();
  };
  reducedMotion.addEventListener('change', event => { if (event.matches) revealAll(); });
  // Keyboard focus must never land on visually hidden content.
  document.addEventListener('focusin', event => {
    const target = event.target.closest('.scroll-reveal');
    if (target) {
      target.classList.add('is-revealed');
      observer.unobserve(target);
    }
  });
}
