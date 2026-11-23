import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root } from './catalog.mjs';

export function publicCatalog(catalog, base) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('CLIENT_ASSET_BASE_URL must be a public HTTPS URL without credentials, query, or fragment.');
  }
  const prefix = base.replace(/\/+$/, '');
  return {
    ...catalog,
    clients: catalog.clients.map(client => ({
      ...client,
      url: client.available ? `${prefix}/clients/${client.id}.html` : null
    }))
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.env.CLIENT_ASSET_BASE_URL;
  if (!base) throw new Error('Set CLIENT_ASSET_BASE_URL to your public Blob store URL. Run npm run upload first. For local files, use npm run dev.');
  const catalog = publicCatalog(JSON.parse(await readFile(path.join(root, 'data/clients.json'), 'utf8')), base);
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await cp(path.join(root, 'public'), path.join(root, 'dist'), { recursive: true });
  await writeFile(path.join(root, 'dist/catalog.json'), JSON.stringify(catalog));
  console.log(`Built launcher with ${catalog.clients.length} catalog entries. Client payloads stay in Blob storage.`);
}
