const origin = import.meta.env.VITE_HACOLIO_DEMO_URL?.replace(/\/$/, '');
const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const dialog = document.getElementById('demo-invite-dialog');
const configured = origin === 'https://demo.hacolio.com' && Boolean(sitekey);

if ((configured || import.meta.env.DEV) && dialog) {
  const openers = [...document.querySelectorAll('[data-demo-open]')];
  const form = dialog.querySelector('form');
  const submit = form.querySelector('[type="submit"]');
  const status = dialog.querySelector('[data-demo-status]');
  const widget = dialog.querySelector('[data-demo-challenge]');
  const email = form.elements.email;
  let challenge = '', widgetId, widgetSize, loading, sending = false, returnFocus;

  const loadChallenge = () => {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.addEventListener('load', () => window.turnstile ? resolve(window.turnstile) : reject(new Error()), { once: true });
      script.addEventListener('error', () => { script.remove(); loading = undefined; reject(new Error()); }, { once: true });
      document.head.append(script);
    });
    return loading;
  };

  const resetChallenge = () => {
    challenge = '';
    submit.disabled = true;
    if (widgetId !== undefined) window.turnstile?.reset(widgetId);
  };

  openers.forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      returnFocus = button;
      if (!sending) {
        form.hidden = false;
        status.textContent = '';
        submit.textContent = configured ? '招待メールを受け取る' : '受付準備中';
        resetChallenge();
      }
      dialog.showModal();
      document.documentElement.classList.add('demo-invite-open');
      email.focus();
      if (!configured) {
        widget.hidden = true;
        status.textContent = '招待メールの受付は準備中です。現在はメールを送信できません。';
        return;
      }
      try {
        const turnstile = await loadChallenge();
        const size = widget.clientWidth < 300 ? 'compact' : 'flexible';
        if (widgetId !== undefined && widgetSize !== size) { turnstile.remove(widgetId); widgetId = undefined; }
        widgetSize = size;
        if (widgetId === undefined) widgetId = turnstile.render(widget, {
          sitekey, action: 'demo-invite', theme: 'light', size,
          callback: token => { challenge = token; submit.disabled = sending; },
          'expired-callback': () => { challenge = ''; submit.disabled = true; },
          'error-callback': () => { challenge = ''; submit.disabled = true; status.textContent = '確認操作を読み込めませんでした。閉じてから、もう一度お試しください。'; },
        });
      } catch { status.textContent = '確認操作を読み込めませんでした。通信環境を確認し、もう一度お試しください。'; }
    });
  });

  dialog.querySelector('[data-demo-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('demo-invite-open');
    returnFocus?.focus({ preventScroll: true });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!configured) {
      status.textContent = '招待メールの受付は準備中です。現在はメールを送信できません。';
      return;
    }
    if (sending || !form.reportValidity()) return;
    if (!challenge) { status.textContent = '確認操作を完了してください。'; return; }
    sending = true;
    submit.disabled = true;
    submit.textContent = '送信しています…';
    status.textContent = '';
    try {
      const response = await fetch(`${origin}/api/demo-access/request`, {
        method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value.trim(), challenge }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'メールを送信できませんでした。');
      form.hidden = true;
      status.textContent = '招待メールを送信しました。15分以内にメールのリンクを開いてください。届かない場合は迷惑メールフォルダーもご確認ください。';
    } catch (error) {
      status.textContent = error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'TypeError'
        ? error.message : '接続できませんでした。企業・学校のネットワークでは、セキュリティ設定により接続が制限される場合があります。申込画面内のFigmaの画面資料もご覧いただけます。';
    } finally {
      sending = false;
      submit.textContent = '招待メールを受け取る';
      resetChallenge();
    }
  });
}
