import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
fs.mkdirSync('tmp/hacolio-demo-review', { recursive: true });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = [], sent = []; let responseStatus = 429;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({
      contentType: 'application/javascript', body: `window.turnstile={render(node,options){const button=document.createElement('button');button.type='button';button.dataset.testChallenge='';button.textContent='確認操作（オフラインテスト）';button.style.cssText='min-height:65px;max-width:100%;padding:12px;border:1px solid #cccac3;background:#ffffff88';button.onclick=()=>options.callback('offline-review-challenge');node.append(button);return 'test-widget';},reset(){},remove(){document.querySelector('[data-test-challenge]')?.remove();}};`,
    }));
    await page.route('https://demo.hacolio.com/api/demo-access/request', route => {
      const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:5176', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      sent.push(route.request().postDataJSON());
      return route.fulfill({ status: responseStatus, headers, contentType: 'application/json', body: JSON.stringify(responseStatus === 202 ? { message: 'sent' } : { error: '送信回数の上限に達しました。時間をおいてお試しください。' }) });
    });
    await page.goto('http://127.0.0.1:5176/', { waitUntil: 'domcontentloaded' });
    const opener = page.locator('[data-demo-open]');
    await opener.click();
    const dialog = page.getByRole('dialog'), submit = dialog.getByRole('button', { name: '招待メールを受け取る' });
    assert(await dialog.isVisible()); assert(await submit.isDisabled());
    assert.equal(await page.evaluate(() => document.activeElement.id), 'demo-invite-email');
    await page.locator('[data-test-challenge]').click(); assert(await submit.isEnabled());
    await submit.click(); assert.equal(sent.length, 0); // Native required/email validation.
    await dialog.getByLabel('メールアドレス').fill('viewer@example.com');
    await submit.click();
    await page.waitForFunction(() => document.querySelector('[data-demo-status]').textContent.includes('上限'));
    assert.equal(sent.length, 1); assert.deepEqual(sent[0], { email: 'viewer@example.com', challenge: 'offline-review-challenge' });
    assert(await submit.isDisabled());
    responseStatus = 202;
    await page.locator('[data-test-challenge]').click(); await submit.click();
    await page.waitForFunction(() => document.querySelector('[data-demo-status]').textContent.includes('招待メールを送信しました'));
    assert.equal(await page.locator('.demo-invite-form').isVisible(), false);
    const scroll = await page.evaluate(() => scrollY); await page.mouse.wheel(0, 600); await page.waitForTimeout(80); assert.equal(await page.evaluate(() => scrollY), scroll);
    assert.equal(await page.evaluate(() => document.querySelector('dialog').scrollWidth > document.querySelector('dialog').clientWidth), false);
    await page.screenshot({ path: `tmp/hacolio-demo-review/sent-${width}.png` });
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog').open);
    assert.equal(await opener.evaluate(el => document.activeElement === el), true);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('demo-invite-open')), false);
    await opener.click(); await page.waitForTimeout(40);
    assert(await page.locator('.demo-invite-form').isVisible());
    await page.screenshot({ path: `tmp/hacolio-demo-review/form-${width}.png` });
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: dialog, validation, bot challenge, rate-limit error, retry, success, scroll lock, focus restoration and no overflow.`);
    await page.close();
  }
} finally { await browser.close(); }
console.log('No real emails were sent; challenge and email endpoints were mocked in the browser.');
