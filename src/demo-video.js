// Fade each demo to black before rewinding, then fade its next playback in.
document.querySelectorAll('.hacolio-detail-image, .sukima-detail-video, .project-demo').forEach(container => {
  const video = container.querySelector('video');
  const button = container.querySelector('.demo-toggle');
  if (!video || !button) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused = false, visible = false, restarting = false, generation = 0;
  let animation = null;
  video.muted = true;
  video.loop = false;
  const allowed = () => visible && !document.hidden && !userPaused && !reduced.matches;
  const update = () => {
    const playing = !userPaused && (!video.paused || restarting);
    button.textContent = playing ? 'Pause' : 'Play';
    button.setAttribute('aria-label', playing ? 'デモを一時停止' : 'デモを再生');
  };
  const cancelRestart = () => {
    generation++;
    restarting = false;
    animation?.cancel();
    animation = null;
    video.style.removeProperty('filter');
  };
  const fade = async (from, to, duration) => {
    animation = video.animate([{ filter: 'brightness(' + from + ')' }, { filter: 'brightness(' + to + ')' }],
      { duration, easing: 'ease-in-out', fill: 'forwards' });
    await animation.finished;
  };
  const restart = async () => {
    if (restarting || !allowed()) return;
    restarting = true;
    const token = ++generation;
    update();
    try {
      await fade(1, 0, 650);
      if (token !== generation || !allowed()) return;
      // Wait for the first frame to be ready while the screen is still dark.
      await new Promise(resolve => {
        const done = () => { clearTimeout(timer); video.removeEventListener('seeked', done); resolve(); };
        const timer = setTimeout(done, 2000);
        video.addEventListener('seeked', done, { once: true });
        video.currentTime = 0;
      });
      if (token !== generation || !allowed()) return;
      await video.play();
      if (token !== generation || !allowed()) return;
      await fade(0, 1, 850);
    } catch {
      // Cancellation, media errors, and autoplay rejection must not leave a dark frame.
    } finally {
      if (token === generation) { cancelRestart(); update(); }
    }
  };
  const sync = () => {
    if (allowed()) {
      if (!restarting) {
        if (video.ended) restart();
        else video.play().catch(update);
      }
    } else {
      cancelRestart();
      video.pause();
      update();
    }
  };
  video.addEventListener('ended', restart);
  video.addEventListener('play', update);
  video.addEventListener('pause', update);
  video.addEventListener('error', () => { cancelRestart(); update(); });
  button.addEventListener('click', () => {
    if (restarting || !video.paused) {
      userPaused = true;
      cancelRestart();
      video.pause();
    } else {
      userPaused = false;
      if (video.ended && !reduced.matches) restart();
      else video.play().catch(update);
    }
    update();
  });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }, { threshold: .15 }).observe(video);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  if (reduced.matches) video.pause();
  update();
});
