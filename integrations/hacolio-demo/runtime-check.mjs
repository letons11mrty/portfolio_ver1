// This exercises only a local HTTPS Worker with synthetic secrets. It never requests an invitation email.
import https from 'node:https';
import assert from 'node:assert/strict';
const port = Number(process.argv[2] || 8795);
const call = (pathname, method = 'GET', headers = {}, body) => new Promise((resolve, reject) => {
  const request = https.request({ hostname: '127.0.0.1', port, path: pathname, method,
    rejectUnauthorized: false, // Local Wrangler's self-signed certificate; hostname is fixed to loopback.
    // --local-upstream supplies the app Host; leaving the local Host intact prevents Origin rewriting.
    headers: { 'x-forwarded-proto': 'https', ...headers } }, response => {
    let text = ''; response.setEncoding('utf8'); response.on('data', value => { text += value; });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text }));
  });
  request.on('error', reject); request.end(body);
});
let response = await call('/api/demo-access/accept');
assert.equal(response.status, 200, response.text); assert(response.text.includes('デモを開く'));
assert(response.headers['content-security-policy'].includes("frame-ancestors 'none'"));
assert.equal(response.headers['set-cookie'], undefined);
response = await call('/api/demo-access/request', 'OPTIONS', { origin: 'https://letons11mrty.github.io', 'access-control-request-method': 'POST' });
assert.equal(response.status, 204, response.text); assert.equal(response.headers['access-control-allow-origin'], 'https://letons11mrty.github.io');
response = await call('/api/demo-access/accept', 'POST', { origin: 'https://demo.hacolio.com', 'content-type': 'application/json' }, JSON.stringify({ token: 'x'.repeat(43) }));
assert.equal(response.status, 410, response.text);
response = await call('/api/demo-access/request', 'POST', { origin: 'https://evil.invalid', 'content-type': 'application/json' }, '{}');
assert.equal(response.status, 403, response.text);
response = await call('/api/demo-access/request', 'POST', { origin: 'https://letons11mrty.github.io', 'content-type': 'application/json' }, 'x'.repeat(4097));
assert.equal(response.status, 413, response.text);
response = await call('/'); assert.equal(response.status, 401, response.text); assert(response.headers['www-authenticate'].startsWith('Basic'));
response = await call('/api/ai-scan', 'POST', { 'content-type': 'application/json' }, '{}'); assert.equal(response.status, 403, response.text);
console.log('PASS Cloudflare local HTTPS runtime: invitation page/CSP, CORS, SQL-backed token rejection, bad origin, body cap, Basic gate and restricted API. No mail provider called.');
