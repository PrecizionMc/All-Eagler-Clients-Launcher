import { CLIENT_CACHE } from './lib/storage.js';

const SHELL_CACHE = 'eagler-vault-shell-v3';
const SHELL = ['/', '/index.html', '/play.html', '/app.js', '/play.js', '/client-runtime.js', '/styles.css', '/tokens.css', '/icon.svg', '/lib/catalog.js', '/lib/storage.js', '/catalog.json'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('eagler-vault-shell-') && name !== SHELL_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/^\/__clients\/[a-f0-9]{64}\.html$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CLIENT_CACHE);
      const response = await cache.match(url.origin + url.pathname);
      if (!response) return new Response('This saved client was removed or evicted. Return to the library and download it again.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      const body = response.body.pipeThrough(new TransformStream({
        transform(chunk, controller) { controller.enqueue(chunk); },
        flush(controller) {
          controller.enqueue(new TextEncoder().encode('<script type="module" src="/client-runtime.js"></script>'));
        }
      }));
      return new Response(body, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Cross-Origin-Opener-Policy': 'same-origin'
        }
      });
    })());
    return;
  }
  if (!SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    let response;
    try {
      response = await fetch(event.request);
    } catch (error) {
      const cached = await cache.match(url.origin + url.pathname);
      if (cached) return cached;
      console.error('Offline launcher resource unavailable', url.pathname, error);
      return new Response('Launcher unavailable offline. Connect once to save the launcher.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
    if (response.ok) {
      try {
        await cache.put(url.origin + url.pathname, response.clone());
      } catch (error) {
        console.error('Could not refresh the offline launcher cache', url.pathname, error);
      }
    }
    return response;
  })());
});
