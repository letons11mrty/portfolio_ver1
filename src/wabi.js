import './work-page-switch.js';

// wabi.js — デモ動画は押したときだけ読み込み・再生。控えめなフェード。
(() => {
  document.documentElement.classList.add('js');

  // デモ動画：最初はサムネイルとボタンだけ。押すと動画を読み込む
  document.querySelectorAll('.w-demo').forEach((box) => {
    const { src, poster, label } = box.dataset;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-demo-btn';
    const thumbnail = document.createElement('img');
    thumbnail.className = 'w-demo-thumb';
    thumbnail.src = poster;
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    const caption = document.createElement('span');
    caption.textContent = '操作デモを再生する';
    btn.append(thumbnail, caption);
    btn.setAttribute('aria-label', `${label}を再生する`);
    btn.addEventListener('click', () => {
      const v = document.createElement('video');
      v.src = src;
      v.poster = poster;
      v.controls = true;
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      v.loop = true;
      v.setAttribute('aria-label', `${label}（無音）`);
      v.addEventListener('play', () => {
        document.querySelectorAll('.w-demo video').forEach((other) => {
          if (other !== v) other.pause();
        });
      });
      v.addEventListener('error', () => {
        const message = document.createElement('p');
        message.className = 'w-demo-error';
        message.setAttribute('role', 'status');
        message.textContent = '動画を読み込めませんでした。もう一度お試しください。';
        box.replaceChildren(btn, message);
      }, { once: true });
      box.replaceChildren(v);
      v.play().catch(() => {});
    });
    box.appendChild(btn);
  });

  // 控えめなフェード（reduce motion の場合はCSS側で無効）
  const targets = document.querySelectorAll(
    '.w-index-list li, .w-work-media, .w-work-body, .w-about-body, .w-contact > *'
  );
  targets.forEach((el) => el.classList.add('w-reveal'));
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: '0px 0px -10% 0px' }
  );
  targets.forEach((el) => io.observe(el));
})();
