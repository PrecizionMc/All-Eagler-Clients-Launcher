import { filterClients, formatBytes, uniqueClients } from './lib/catalog.js';
import { createClientStore, registerWorker } from './lib/storage.js';

const $ = id => document.getElementById(id);
const store = createClientStore();
let clients = [];
let saved = new Set();
let savedOnly = false;
let download;
let storageReady = false;

function notify(message, error = false) {
  $('notice').textContent = message;
  $('notice').dataset.error = String(error);
  $('notice').hidden = false;
  if (error) console.error(message);
}

function updateConnection() {
  $('connection-label').textContent = navigator.onLine ? 'Local-first launcher' : 'Offline mode';
  $('connection-dot').style.opacity = navigator.onLine ? '1' : '.4';
}

function render() {
  const filtered = filterClients(clients, {
    query: $('search').value,
    version: $('version').value,
    type: $('client-type').value,
    savedOnly,
    saved
  });
  const grid = $('client-grid');
  grid.replaceChildren();
  for (const client of filtered) {
    const card = document.createElement('article');
    card.className = 'client-card';
    card.innerHTML = `<div class="card-art"><span class="card-monogram" aria-hidden="true"></span><span class="card-build"></span><span class="saved-badge" hidden>Saved offline</span></div>
      <div class="card-body"><div class="card-heading"><h3></h3><span class="version-tag"></span></div>
      <div class="card-tags"><span class="type-tag"></span><span class="runtime-tag"></span><span class="size-tag"></span></div>
      <div class="card-actions"></div></div>`;
    const find = selector => card.querySelector(selector);
    if (client.type === 'hacked') find('.card-art').classList.add('art-hacked');
    else if (client.runtime === 'WASM') find('.card-art').classList.add('art-wasm');
    find('.card-monogram').textContent = client.name.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
    find('.card-build').textContent = client.runtime === 'WASM' ? 'WASM / GC' : 'JS / BROWSER';
    find('.saved-badge').hidden = !saved.has(client.id);
    find('h3').textContent = client.name;
    find('.version-tag').textContent = client.version;
    find('.type-tag').textContent = { standard: 'Standard / PvP', hacked: 'Hack client', unverified: 'Unverified' }[client.type];
    find('.runtime-tag').textContent = client.runtime;
    find('.size-tag').textContent = formatBytes(client.bytes);
    if (client.available) {
      const link = document.createElement('a');
      link.className = 'launch-button';
      link.href = `/play.html?id=${client.id}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Launch client ↗';
      link.setAttribute('aria-label', `Launch ${client.name} in a new tab`);
      const button = document.createElement('button');
      button.className = 'save-button';
      button.dataset.id = client.id;
      button.dataset.action = saved.has(client.id) ? 'remove' : 'save';
      button.textContent = saved.has(client.id) ? '×' : '↓';
      button.title = `${saved.has(client.id) ? 'Remove saved copy of' : 'Save'} ${client.name}`;
      button.setAttribute('aria-label', button.title);
      button.disabled = Boolean(download) || !storageReady;
      find('.card-actions').append(link, button);
    } else {
      const issue = document.createElement('p');
      issue.className = 'unavailable';
      issue.textContent = client.issue;
      find('.card-actions').append(issue);
    }
    grid.append(card);
  }
  const savedCount = uniqueClients(clients).filter(client => saved.has(client.id)).length;
  $('saved-count').textContent = savedCount;
  $('result-count').textContent = filtered.length;
  $('showing').textContent = `Showing ${filtered.length} of ${clients.length} builds${savedOnly ? ' · Saved in this browser' : ''}`;
  $('empty-state').hidden = filtered.length !== 0;
  $('empty-message').textContent = savedOnly && savedCount === 0 ? 'Save a client or use Download all to start your offline collection.' : 'Try another search or reset your filters.';
  $('client-grid').setAttribute('aria-busy', 'false');
  $('download-all').disabled = Boolean(download) || !storageReady;
  $('library-tab').classList.toggle('active', !savedOnly);
  $('saved-tab').classList.toggle('active', savedOnly);
  $('library-tab').setAttribute('aria-pressed', String(!savedOnly));
  $('saved-tab').setAttribute('aria-pressed', String(savedOnly));
}

async function refreshStorage() {
  saved = await store.savedIds();
  const info = await store.estimate();
  const bytes = uniqueClients(clients).filter(client => saved.has(client.id)).reduce((sum, client) => sum + client.bytes, 0);
  $('storage-summary').textContent = `${saved.size} unique clients saved · ${formatBytes(bytes)} of client data${info?.quota != null && info?.usage != null ? ` · ${formatBytes(Math.max(0, info.quota - info.usage))} browser space available` : ' · Browser quota information unavailable'}`;
  render();
}

async function startDownload(client) {
  if (download) return;
  download = new AbortController();
  const signal = download.signal;
  $('notice').hidden = true;
  $('download-panel').hidden = false;
  $('download-progress').value = 0;
  $('download-title').textContent = client ? `Saving ${client.name}` : 'Saving the complete library';
  $('download-detail').textContent = 'Checking available browser storage...';
  render();
  try {
    if (client) {
      await store.save(client, { signal, onProgress: received => {
        $('download-progress').value = received / client.bytes * 100;
        $('download-detail').textContent = `${formatBytes(received)} / ${formatBytes(client.bytes)}`;
      } });
      notify(`${client.name} is saved in this browser.`);
    } else {
      const result = await store.saveAll(clients, { signal, onProgress: progress => {
        $('download-progress').value = progress.total ? progress.received / progress.total * 100 : 100;
        $('download-title').textContent = `Saving ${progress.index + 1} of ${progress.count} · ${progress.client.name}`;
        $('download-detail').textContent = `${formatBytes(progress.received)} / ${formatBytes(progress.total)} · You can cancel and resume later.`;
      } });
      notify(result.count ? `Saved ${result.count} unique clients (${formatBytes(result.bytes)}). Your library is ready.` : 'All playable clients are already saved in this browser.');
    }
    $('download-progress').value = 100;
  } catch (error) {
    if (signal.aborted) notify('Download canceled. Completed clients are still saved. Download all will resume the remaining files.');
    else notify(error.message, true);
  } finally {
    download = null;
    $('download-panel').hidden = true;
    try { await refreshStorage(); } catch (error) { notify(error.message, true); render(); }
  }
}

$('search').addEventListener('input', render);
$('version').addEventListener('change', render);
$('client-type').addEventListener('change', render);
$('reset-filters').addEventListener('click', () => {
  $('search').value = '';
  $('version').value = '';
  $('client-type').value = '';
  render();
});
for (const [id, value] of [['library-tab', false], ['saved-tab', true]]) {
  $(id).addEventListener('click', () => {
    savedOnly = value;
    $('library-title').firstChild.textContent = value ? 'Saved clients ' : 'Client library ';
    render();
  });
}
$('download-all').addEventListener('click', () => startDownload());
$('cancel-download').addEventListener('click', () => download?.abort());
$('client-grid').addEventListener('click', async event => {
  const button = event.target.closest('button[data-id]');
  if (!button || download) return;
  const client = clients.find(client => client.id === button.dataset.id);
  if (button.dataset.action === 'save') await startDownload(client);
  else {
    button.disabled = true;
    try {
      await store.remove(client);
      await refreshStorage();
      notify(`Removed the saved copy of ${client.name}. Your game worlds were not deleted.`);
    } catch (error) { notify(error.message, true); button.disabled = false; }
  }
});
$('persist-storage').addEventListener('click', async () => {
  try {
    const granted = await store.persist();
    notify(granted ? 'Persistent storage granted. Saved clients are protected from automatic eviction, but clearing site data still removes them.' : 'Persistent storage was not granted by this browser. Saved clients still work, but the browser may clear them to free space.');
  } catch (error) { notify(error.message, true); }
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
    event.preventDefault();
    $('search').focus();
  }
});
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
window.addEventListener('focus', async () => {
  if (!storageReady || download) return;
  try { await refreshStorage(); } catch (error) { notify(error.message, true); }
});
window.addEventListener('beforeunload', event => {
  if (download) { event.preventDefault(); event.returnValue = ''; }
});

async function init() {
  updateConnection();
  try {
    const response = await fetch('/catalog.json');
    if (!response.ok) throw new Error(`Could not load the client catalog (${response.status}). Reload to retry.`);
    const catalog = await response.json();
    clients = catalog.clients;
    const versions = [...new Set(clients.map(client => client.version))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) $('version').add(new Option(version, version));
    const unique = uniqueClients(clients);
    const total = unique.reduce((sum, client) => sum + client.bytes, 0);
    $('total-clients').textContent = clients.length;
    $('total-versions').textContent = versions.filter(version => version !== 'Unknown').length;
    $('total-size').textContent = formatBytes(total);
    $('download-size').textContent = formatBytes(total);
    render();
    if (catalog.local) notify('Local preview: clients are streamed from your uploaded files. Production will use your public Vercel Blob store.');
    await registerWorker();
    storageReady = true;
    await refreshStorage();
  } catch (error) {
    notify(error.message, true);
    $('showing').textContent = clients.length ? 'Collection loaded. Offline storage could not be initialized.' : 'Collection could not be loaded.';
    $('client-grid').setAttribute('aria-busy', 'false');
  }
}
init();
