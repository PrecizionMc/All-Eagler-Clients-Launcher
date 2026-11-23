import { formatBytes } from './lib/catalog.js';
import { clientPath, createClientStore, registerWorker } from './lib/storage.js';

const controller = new AbortController();
const $ = id => document.getElementById(id);
$('cancel-play').addEventListener('click', () => controller.abort());
window.addEventListener('beforeunload', () => controller.abort());

async function launch() {
  try {
    const id = new URL(location.href).searchParams.get('id');
    if (!/^[a-f0-9]{64}$/.test(id ?? '')) throw new Error('Invalid client link. Choose a client from the library.');
    await registerWorker();
    const response = await fetch('/catalog.json', { signal: controller.signal });
    if (!response.ok) throw new Error(`Could not load the catalog (${response.status}).`);
    const { clients } = await response.json();
    const client = clients.find(client => client.id === id);
    if (!client?.available) throw new Error(client?.issue ?? 'This client is not in the current catalog.');
    document.title = `Launching ${client.name} - Eagler Vault`;
    $('play-title').textContent = client.name;
    await createClientStore().save(client, {
      signal: controller.signal,
      onProgress: bytes => {
        $('play-progress').value = bytes / client.bytes * 100;
        $('play-status').textContent = `Saving to this browser: ${formatBytes(bytes)} / ${formatBytes(client.bytes)}`;
      }
    });
    controller.signal.throwIfAborted();
    $('play-status').textContent = 'Saved. Launching your client...';
    location.replace(clientPath(id));
  } catch (error) {
    $('play-title').textContent = controller.signal.aborted ? 'Download canceled.' : 'Unable to launch.';
    $('play-status').textContent = 'You can return to the library and try again.';
    $('play-error').textContent = controller.signal.aborted ? 'This download was canceled. Previously saved clients are unchanged.' : error.message;
    $('play-error').hidden = false;
    $('cancel-play').hidden = true;
    if (!controller.signal.aborted) console.error(error);
  }
}
launch();
