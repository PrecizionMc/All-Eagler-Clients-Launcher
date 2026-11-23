import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { head, put, BlobNotFoundError } from '@vercel/blob';
import { inspectClient, root } from './catalog.mjs';

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error('Set BLOB_READ_WRITE_TOKEN in .env.local before uploading. Never commit or share the token.');
}
const { clients } = JSON.parse(await readFile(path.join(root, 'data/clients.json'), 'utf8'));
const unique = [...new Map(clients.map(client => [client.id, client])).values()];
let base;
for (const client of unique) {
  // Verify content before trusting the immutable, content-addressed pathname.
  const actual = await inspectClient(client.file);
  if (actual.id !== client.id) throw new Error(`${client.file} changed. Run npm run catalog before uploading.`);
  const pathname = `clients/${client.id}.html`;
  let existing;
  try {
    existing = await head(pathname);
  } catch (error) {
    if (!(error instanceof BlobNotFoundError)) throw error;
  }
  if (existing && existing.size !== client.bytes) throw new Error(`Stored size mismatch for ${client.file}.`);
  const blob = existing ?? await put(pathname, createReadStream(path.join(root, client.file)), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'text/html; charset=utf-8',
    multipart: true
  });
  base = new URL(blob.url).origin;
  console.log(`${existing ? 'Already stored' : 'Uploaded'}: ${client.file}`);
}
console.log(`\nUpload complete. Set CLIENT_ASSET_BASE_URL=${base} in .env.local and in Vercel, then deploy.`);
