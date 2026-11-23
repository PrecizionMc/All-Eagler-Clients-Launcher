import assert from 'node:assert/strict';
import test from 'node:test';
import { createClientStore } from '../public/lib/storage.js';

const client = { id: 'a'.repeat(64), available: true, bytes: 5, url: 'https://storage.example/a.html' };
function harness({ quota = 100000, fetch: fetcher = async () => new Response('hello') } = {}) {
  const entries = new Map();
  let requests = 0;
  const cache = {
    keys: async () => [...entries.keys()].map(url => ({ url })),
    match: async key => entries.has(key) ? new Response(entries.get(key)) : undefined,
    put: async (key, response) => { entries.set(key, await response.arrayBuffer()); },
    delete: async key => entries.delete(key)
  };
  const store = createClientStore({
    caches: { open: async () => cache },
    storage: { estimate: async () => ({ quota, usage: 0 }) },
    locks: undefined,
    origin: 'https://launcher.example',
    fetch: async (...args) => { requests++; return fetcher(...args); }
  });
  return { store, entries, requests: () => requests };
}

test('bulk saves unique playable files, reports bytes, and resumes without refetching', async () => {
  const { store, requests } = harness();
  const progress = [];
  const files = [client, { ...client }, { ...client, id: 'b'.repeat(64), available: false }];
  assert.deepEqual(await store.saveAll(files, { onProgress: value => progress.push(value) }), { count: 1, bytes: 5 });
  assert.equal(requests(), 1);
  assert.equal(progress.at(-1).received, 5);
  assert.deepEqual(await store.saveAll(files), { count: 0, bytes: 0 });
  assert.equal(requests(), 1);
  assert.equal((await store.savedIds()).size, 1);
  await store.remove(client);
  assert.equal((await store.savedIds()).size, 0);
});

test('quota failure is explicit and happens before any download', async () => {
  const { store, requests } = harness({ quota: 4 });
  await assert.rejects(store.saveAll([client]), /Not enough browser storage/);
  assert.equal(requests(), 0);
});

test('HTTP errors and truncated bodies do not become saved clients', async () => {
  for (const response of [new Response('no', { status: 403 }), new Response('oops'), new Response('too large')]) {
    const { store } = harness({ fetch: async () => response });
    await assert.rejects(store.save(client), /Download/);
    assert.equal((await store.savedIds()).size, 0);
  }
});

test('cancellation stops bulk downloads and keeps completed clients', async () => {
  const controller = new AbortController();
  const { store, requests } = harness();
  const second = { ...client, id: 'b'.repeat(64) };
  await assert.rejects(store.saveAll([client, second], {
    signal: controller.signal,
    onProgress: ({ client: current }) => {
      if (current.id === second.id) controller.abort();
    }
  }), { name: 'AbortError' });
  assert.equal(requests(), 2);
  assert.deepEqual(await store.savedIds(), new Set([client.id]));
});
