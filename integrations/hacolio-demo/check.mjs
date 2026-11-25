// Offline checks: real application code and SQLite, synthetic secrets and mocked providers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { prepareDemoIntegration } from './install.mjs';

const root = path.resolve(process.argv[2] || 'C:/創作/Hacolio');
const files = new Map([...prepareDemoIntegration(root)].map(([name, text]) => [path.resolve(root, name), text]));
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...args) {
  const source = name.startsWith('@/') ? path.join(root, name.slice(2))
    : name.startsWith('.') ? path.resolve(path.dirname(parent.filename), name) : name;
  for (const candidate of [source, source + '.ts']) if (files.has(path.normalize(candidate))) return path.normalize(candidate);
  return resolve.call(this, source, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  files.get(path.normalize(filename)) ?? fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
).outputText, filename);

Object.assign(process.env, {
  APP_ENV: 'demo', ACCOUNTS_ENABLED: '1', BASIC_AUTH_ENABLED: '1', HACOLIO_DEPLOYMENT: 'portfolio-demo',
  HACOLIO_OBJECT_NAME: 'portfolio-demo-test', DEMO_ACCESS_ENABLED: '1', DEMO_PUBLIC_ORIGIN: 'https://demo.hacolio.com',
  DEMO_ALLOWED_ORIGINS: 'https://letons11mrty.github.io', AUTH_DB_PATH: ':memory:', INVENTORY_DB_PATH: ':memory:',
  DEMO_ACCESS_SECRET: 'offline-test-only-demo-secret-with-at-least-32-characters',
  BASIC_AUTH_USER: 'offline-demo', BASIC_AUTH_PASSWORD: 'offline-test-only-basic-password-32-characters',
  DEMO_TURNSTILE_SECRET: 'offline-challenge-secret', DEMO_RESEND_API_KEY: 'offline-mail-key', DEMO_EMAIL_FROM: 'demo@hacolio.com',
});
const { NextRequest } = require('next/server');
const requests = require(path.join(root, 'app/api/demo-access/request/route.ts'));
const acceptance = require(path.join(root, 'app/api/demo-access/accept/route.ts'));
const accountRoute = require(path.join(root, 'app/api/account/route.ts'));
const accounts = require(path.join(root, 'lib/server/accounts.ts'));
const demo = require(path.join(root, 'lib/server/demoAccess.ts'));
const { proxy } = require(path.join(root, 'proxy.ts'));
const outgoing = [], usedChallenges = new Set(); let sequence = 0, rejectMail = false;
globalThis.fetch = async (url, options) => {
  if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
    const body = JSON.parse(options.body), valid = !usedChallenges.has(body.response) && !body.response.startsWith('bad');
    usedChallenges.add(body.response);
    return Response.json({ success: valid, hostname: body.response === 'wrong-host' ? 'evil.invalid' : 'letons11mrty.github.io', action: 'demo-invite' });
  }
  if (url === 'https://api.resend.com/emails') {
    if (rejectMail) return Response.json({ error: 'provider unavailable' }, { status: 503 });
    outgoing.push(JSON.parse(options.body)); return Response.json({ id: 'offline-mail' });
  }
  throw new Error('Network is not permitted during offline checks: ' + url);
};
const request = (pathname, body, extra = {}, method = body === undefined ? 'GET' : 'POST') => new NextRequest('https://demo.hacolio.com' + pathname, {
  method, headers: { host: 'demo.hacolio.com', 'x-forwarded-proto': 'https', origin: 'https://letons11mrty.github.io',
    'cf-connecting-ip': `offline-${sequence++}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extra },
  ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
});
const requestPath = '/api/demo-access/request', acceptPath = '/api/demo-access/accept';
const submit = (email, extra = {}) => requests.POST(request(requestPath, { email, challenge: `challenge-${sequence}` }, extra));
const accept = token => acceptance.POST(request(acceptPath, { token }, { origin: 'https://demo.hacolio.com' }));
const invitation = () => outgoing.at(-1).text.match(/\/accept#([A-Za-z0-9_-]{43})/)[1];
const cookie = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
const appRequest = (cookies, body, extra = {}) => request('/api/account', body, { cookie: cookies, origin: 'https://demo.hacolio.com', ...extra });

assert.equal(requests.OPTIONS(request(requestPath, undefined, {}, 'OPTIONS')).status, 204);
assert.equal(requests.OPTIONS(request(requestPath, undefined, { origin: 'https://evil.invalid' }, 'OPTIONS')).status, 403);
assert.equal((await submit('tester@example.com', { origin: 'https://evil.invalid' })).status, 403);
assert.equal((await requests.POST(request(requestPath, { email: 'tester@example.com', challenge: 'wrong-host' }))).status, 400);
assert.equal((await requests.POST(request(requestPath, 'x'.repeat(4097)))).status, 413);
assert.equal((await submit('bad\r\nBcc: other@example.com')).status, 400);
assert.equal(outgoing.length, 0);
console.log('PASS: CORS allowlist, challenge hostname, input size and mail-header injection checks.');

assert.equal((await submit("o'brien@example.com")).status, 202);
const firstToken = invitation(), db = accounts.demoAccountDatabase();
assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 0);
const stored = db.prepare('SELECT * FROM portfolio_demo_invites').get();
assert(!Object.values(stored).includes(firstToken)); assert(!Object.values(stored).includes("o'brien@example.com"));
assert(!outgoing[0].text.includes(process.env.BASIC_AUTH_PASSWORD));
const page = acceptance.GET(request(acceptPath)); assert.equal(page.status, 200);
assert(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 0); // Opening/scanning the link cannot register anyone.
const accepted = await accept(firstToken); assert.equal(accepted.status, 200);
for (const value of accepted.headers.getSetCookie()) { assert.match(value, /HttpOnly/i); assert.match(value, /Secure/i); assert.match(value, /SameSite=Lax/i); assert.match(value, /Max-Age=86400/i); }
const aliceCookies = cookie(accepted), alice = accounts.requireAccount(appRequest(aliceCookies));
assert.equal(proxy(appRequest(aliceCookies)).headers.get('x-middleware-next'), '1');
assert.equal((await accept(firstToken)).status, 410);
assert.equal((await accept(firstToken.slice(0, -1) + (firstToken.endsWith('a') ? 'b' : 'a'))).status, 410);
console.log('PASS: no account on GET, one-use token, hashed invite/email, 24-hour secure cookies and Basic-cookie handoff.');

assert.equal((await submit('second@example.com')).status, 202);
const concurrentToken = invitation();
const simultaneous = await Promise.all([accept(concurrentToken), accept(concurrentToken)]);
assert.deepEqual(simultaneous.map(response => response.status).sort(), [200, 410]);
const bobCookies = cookie(simultaneous.find(response => response.status === 200));
assert.throws(() => accounts.requireAccount(appRequest(bobCookies, undefined, { 'x-workspace-id': alice.workspaceId })), error => error.status === 403);
assert.throws(() => accounts.requireAccount(appRequest(bobCookies, undefined, { 'x-workspace-id': "' OR 1=1 --" })), error => error.status === 403);
const sqlText = "x'); DROP TABLE users;--";
assert.equal((await accountRoute.POST(appRequest(aliceCookies, { action: 'profile', displayName: sqlText }))).status, 200);
assert.equal(accounts.accountState(alice).user.displayName, sqlText);
for (const action of ['register', 'login', 'createGroup', 'invite', 'password']) assert.equal((await accountRoute.POST(appRequest(aliceCookies, { action }))).status, 403);
for (const pathname of ['/admin', '/api/admin/manage', '/api/ai-scan', '/api/catalog', '/api/account/google', '/api/group-chat/photo', '/api/inventory/images/test']) assert.equal(proxy(request(pathname, undefined, { cookie: aliceCookies })).status, 403);
console.log('PASS: concurrent replay, workspace isolation, SQL binding, blocked account escalation and costly/upload features.');

for (let n = 0; n < 3; n++) assert.equal((await submit('limited@example.com')).status, 202);
assert.equal((await submit('limited@example.com')).status, 429);
const stale = outgoing.at(-1).text.match(/\/accept#([A-Za-z0-9_-]{43})/)[1];
rejectMail = true; assert.equal((await submit('failure@example.com')).status, 503); rejectMail = false;
assert.equal(db.prepare('SELECT count(*) n FROM portfolio_demo_invites WHERE sent=0').get().n, 0);
const now = Date.now;
try {
  Date.now = () => now() + 16 * 60_000;
  assert.equal((await accept(stale)).status, 410);
  Date.now = () => now() + 25 * 60 * 60_000;
  assert.throws(() => accounts.requireAccount(appRequest(aliceCookies)), error => error.status === 401);
  demo.cleanupDemoAccess();
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM workspaces').get().n, 0);
} finally { Date.now = now; }
console.log('PASS: email quota, failed-send invalidation, 15-minute expiry, session expiry and personal-data cleanup.');

process.env.HACOLIO_OBJECT_NAME = 'hacolio-v1';
assert.equal(proxy(request(acceptPath)).status, 401);
assert.equal((await requests.POST(request(requestPath, { email: 'x@example.com', challenge: 'test' }))).status, 404);
process.env.APP_ENV = 'staging'; process.env.STAGING_BASIC_USER = 'offline-preview'; process.env.STAGING_BASIC_PASSWORD = 'offline-preview-password';
assert.equal(proxy(request(acceptPath)).status, 401);
const auth = 'Basic ' + Buffer.from('offline-preview:offline-preview-password').toString('base64');
assert.equal(proxy(request('/', undefined, { authorization: auth })).headers.get('x-middleware-next'), '1');
console.log('PASS: existing preview cannot expose demo endpoints; its Basic authentication still works.');
console.log('All tests used memory-only SQLite, synthetic credentials and mocked mail/challenge providers.');
