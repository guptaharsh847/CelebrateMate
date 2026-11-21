// Verifies the BUILT service worker (dist/sw.js) in a simulated worker scope:
//   node scripts/verify-sw.mjs [scopeUrl]
// Checks precache contents, scope handling, offline navigation fallback and
// that API / cross-origin / non-GET requests are never intercepted or cached.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const scope = process.argv[2] || 'https://example.github.io/CelebrateMate/';
const source = readFileSync(resolve('dist/sw.js'), 'utf8');
const origin = new URL(scope).origin;

const listeners = {};
const cacheStore = new Map(); // url -> body
let network = 'online';
const imported = [];

class FakeRequest {
  constructor(url, init = {}) {
    this.url = typeof url === 'string' ? url : url.url;
    this.method = init.method || 'GET';
    this.mode = init.mode || 'cors';
  }
}

const fakeFetch = async (req) => {
  const url = typeof req === 'string' ? req : req.url;
  if (network === 'offline') throw new TypeError('Failed to fetch');
  return { url, body: `network:${url}` };
};

const caches = {
  open: async () => ({
    addAll: async (reqs) => reqs.forEach((r) => cacheStore.set(r.url, `cached:${r.url}`)),
  }),
  keys: async () => ['celebratemate-shell-old', 'other-app-cache'],
  delete: async (k) => cacheStore.set(`deleted:${k}`, true),
  match: async (req) => {
    const url = (typeof req === 'string' ? req : req.url).split('?')[0];
    return cacheStore.has(url) ? { url, body: cacheStore.get(url) } : undefined;
  },
};

const self = {
  registration: { scope },
  location: { origin },
  addEventListener: (type, fn) => (listeners[type] = fn),
  skipWaiting: async () => {},
  clients: { claim: async () => {} },
};

vm.runInNewContext(source, {
  self,
  caches,
  fetch: fakeFetch,
  Request: FakeRequest,
  URL,
  Set,
  Promise,
  importScripts: (url) => imported.push(url),
  console,
});

async function dispatch(type, request) {
  let responded = null;
  let waited = null;
  const event = { request, respondWith: (p) => (responded = p), waitUntil: (p) => (waited = p) };
  listeners[type](event);
  if (waited) await waited;
  return responded ? await responded : null;
}

// 1. OneSignal worker imported, v16
assert.deepEqual(imported, ['https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js']);

// 2. Install precaches only in-scope files, including index.html
await dispatch('install');
const cached = [...cacheStore.keys()].filter((k) => !k.startsWith('deleted:'));
assert.ok(cached.includes(`${scope}index.html`), 'index.html precached');
assert.ok(cached.includes(`${scope}manifest.webmanifest`), 'manifest precached');
assert.ok(cached.every((u) => u.startsWith(scope)), 'all precached URLs inside scope');
assert.ok(!cached.some((u) => u.endsWith('sw.js')), 'worker does not cache itself');

// 3. Activate deletes only old CelebrateMate caches
await dispatch('activate');
assert.ok(cacheStore.has('deleted:celebratemate-shell-old'));
assert.ok(!cacheStore.has('deleted:other-app-cache'));

// 4. Never intercept API, Google, OneSignal, fonts, or POST
for (const url of [
  'https://script.google.com/macros/s/X/exec',
  'https://accounts.google.com/gsi/client',
  'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js',
  'https://fonts.googleapis.com/css2?family=x',
]) {
  assert.equal(await dispatch('fetch', new FakeRequest(url)), null, `must not intercept ${url}`);
}
assert.equal(await dispatch('fetch', new FakeRequest(`${scope}index.html`, { method: 'POST' })), null, 'must not intercept POST');
assert.equal(await dispatch('fetch', new FakeRequest(`${origin}/other-app/index.html`)), null, 'must not intercept outside scope');

// 5. Navigation: network first, cached shell offline
const online = await dispatch('fetch', new FakeRequest(`${scope}#/contacts`, { mode: 'navigate' }));
assert.match(online.body, /^network:/);
network = 'offline';
const offline = await dispatch('fetch', new FakeRequest(`${scope}#/contacts`, { mode: 'navigate' }));
assert.equal(offline.body, `cached:${scope}index.html`);

// 6. Hashed assets served from cache (offline)
const asset = cached.find((u) => u.includes('/assets/') && u.endsWith('.js'));
const assetRes = await dispatch('fetch', new FakeRequest(`${asset}?v=1`));
assert.equal(assetRes.body, `cached:${asset}`);

console.log(`✓ service worker verified for scope ${scope} (${cached.length} precached files)`);
