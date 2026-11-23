import { uniqueClients } from './catalog.js';

export const CLIENT_CACHE = 'eagler-vault-clients-v1';
export const clientPath = id => `/__clients/${id}.html`;

export function createClientStore({
  caches = globalThis.caches,
  storage = globalThis.navigator?.storage,
  fetch = globalThis.fetch,
  locks = globalThis.navigator?.locks,
  origin = globalThis.location?.origin
} = {}) {
  function supported() {
    if (!caches || !origin) throw new Error('Browser storage is unavailable. Use HTTPS (or localhost) in a browser with Cache Storage enabled.');
  }
  async function cache() {
    supported();
    return caches.open(CLIENT_CACHE);
  }
  async function savedIds() {
    const keys = await (await cache()).keys();
    return new Set(keys.map(key => new URL(key.url).pathname.match(/^\/__clients\/([a-f0-9]{64})\.html$/)?.[1]).filter(Boolean));
  }
  async function estimate() {
    return storage?.estimate ? storage.estimate() : null;
  }
  async function checkSpace(bytes) {
    const info = await estimate();
    if (info?.quota != null && info?.usage != null && info.quota - info.usage < bytes * 1.05) {
      throw new Error('Not enough browser storage. Free some space or save fewer clients.');
    }
  }
  async function save(client, { signal, onProgress = () => {} } = {}) {
    const run = async () => {
      if (!client.available || !client.url) throw new Error(client.issue ?? 'This client has no configured download URL.');
      signal?.throwIfAborted();
      const target = new URL(clientPath(client.id), origin).href;
      const store = await cache();
      if (await store.match(target)) {
        onProgress(client.bytes);
        return;
      }
      await checkSpace(client.bytes);
      const response = await fetch(client.url, { signal, credentials: 'omit', cache: 'no-store' });
      if (!response.ok || response.type === 'opaque' || !response.body) {
        throw new Error(`Download failed (${response.status}). Check the client URL and public storage CORS settings.`);
      }
      let received = 0;
      const body = response.body.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          signal?.throwIfAborted();
          received += chunk.byteLength;
          if (received > client.bytes) throw new Error('Download size does not match the catalog. Nothing was saved.');
          onProgress(received);
          controller.enqueue(chunk);
        },
        flush() {
          signal?.throwIfAborted();
          if (received !== client.bytes) throw new Error('Download was incomplete. Nothing was saved; please retry.');
        }
      }));
      try {
        await store.put(target, new Response(body, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': String(client.bytes) }
        }));
      } catch (error) {
        if (error.name === 'QuotaExceededError') {
          throw new Error('Browser storage is full. Previously saved clients are still available. Free space and retry.', { cause: error });
        }
        throw error;
      }
    };
    if (locks) return locks.request(`eagler-client-${client.id}`, { signal }, run);
    return run();
  }
  async function saveAll(clients, { signal, onProgress = () => {} } = {}) {
    const saved = await savedIds();
    const pending = uniqueClients(clients).filter(client => !saved.has(client.id));
    const total = pending.reduce((sum, client) => sum + client.bytes, 0);
    await checkSpace(total);
    let completed = 0;
    for (const [index, client] of pending.entries()) {
      signal?.throwIfAborted();
      await save(client, {
        signal,
        onProgress: bytes => onProgress({ client, received: completed + bytes, total, index, count: pending.length })
      });
      completed += client.bytes;
    }
    return { count: pending.length, bytes: completed };
  }
  async function remove(client) {
    return (await cache()).delete(new URL(clientPath(client.id), origin).href);
  }
  async function persist() {
    if (!storage?.persist) return false;
    return storage.persist();
  }
  return { savedIds, save, saveAll, remove, estimate, persist };
}

export async function registerWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('This browser does not support offline launching. Try a current desktop browser over HTTPS.');
  let timeout;
  try {
    await Promise.race([
      (async () => {
        await navigator.serviceWorker.register('/sw.js', { type: 'module' });
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise(resolve => {
            navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
          });
        }
      })(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Offline storage setup timed out. Check your connection, allow site storage, and reload.')), 20000);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
