import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectClient } from '../scripts/catalog.mjs';
import { publicCatalog } from '../scripts/build.mjs';
import { filterClients, uniqueClients } from '../public/lib/catalog.js';

test('catalog detects late scripts and uses game version instead of client release', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'eagler-catalog-'));
  try {
    const file = 'Example Beta 1.1 (1.8.8).html';
    await writeFile(path.join(directory, file), `<title>Example</title>${' '.repeat(140000)}<script>const moduleName="KillAura";</script>`);
    const client = await inspectClient(file, directory);
    assert.equal(client.available, true);
    assert.equal(client.version, '1.8.8');
    assert.equal(client.type, 'hacked');
    await writeFile(path.join(directory, 'Justin 1.2.4.html'), `<meta content="minecraft, 1.8.8"><script>${' '.repeat(10000)}</script>`);
    assert.equal((await inspectClient('Justin 1.2.4.html', directory)).version, '1.8.8');
    await writeFile(path.join(directory, 'Eaglercraft1.14.html'), '<html>Not a game</html>');
    assert.equal((await inspectClient('Eaglercraft1.14.html', directory)).available, false);
  } finally { await rm(directory, { recursive: true }); }
});

test('search combines local version, hack, text, and saved filters', () => {
  const clients = [
    { id: 'a', name: 'Dragon X', version: '1.8.8', type: 'hacked', runtime: 'JavaScript' },
    { id: 'b', name: 'Pixel', version: '1.12.2', type: 'standard', runtime: 'WASM' }
  ];
  assert.deepEqual(filterClients(clients, { query: ' DRAGON   1.8 ', version: '1.8.8', type: 'hacked', savedOnly: true, saved: new Set(['a']) }), [clients[0]]);
  assert.deepEqual(filterClients(clients, { query: 'Pixel', type: 'hacked' }), []);
  assert.deepEqual(filterClients(clients, { savedOnly: true, saved: new Set() }), []);
});

test('download catalog deduplicates content and excludes invalid uploads', () => {
  const a = { id: 'a', available: true };
  assert.deepEqual(uniqueClients([a, { ...a }, { id: 'b', available: false }]), [a]);
});

test('production URLs are content-addressed, public, and never contain credentials', () => {
  const catalog = { clients: [{ id: 'abc', available: true }, { id: 'bad', available: false }] };
  assert.deepEqual(publicCatalog(catalog, 'https://store.example/').clients.map(client => client.url), ['https://store.example/clients/abc.html', null]);
  for (const base of ['http://example.com', 'https://token@example.com', 'https://example.com/?token=secret']) {
    assert.throws(() => publicCatalog(catalog, base));
  }
});
