import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));

export async function inspectClient(file, directory = root) {
  const filename = path.join(directory, file);
  const { size } = await stat(filename);
  const handle = await open(filename);
  let header;
  try {
    const buffer = Buffer.alloc(Math.min(size, 128 * 1024));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    header = buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
  const hash = createHash('sha256');
  let hacked = false;
  let hasScript = false;
  let tail = '';
  for await (const chunk of createReadStream(filename)) {
    hash.update(chunk);
    const text = tail + chunk.toString('utf8');
    hacked ||= /KillAura|Killaura|killaura|Aimbot|FlyHack/.test(text);
    hasScript ||= /<script[\s>]/i.test(text);
    tail = text.slice(-32);
  }
  const title = header.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const version = file.match(/\((1\.\d+(?:\.\d+)?)\)/)?.[1]
    ?? header.match(/(?:minecraft|eaglercraft|gameversion)[^\n<>]{0,40}?(1\.\d+\.\d+)/i)?.[1]
    ?? title.match(/1\.\d+\.\d+/)?.[0]
    ?? file.match(/1\.\d+(?:\.\d+)?/)?.[0]
    ?? (/^Tuff/i.test(file) ? '1.12.2' : 'Unknown');
  const available = hasScript && size > 10000;
  return {
    id: hash.digest('hex'),
    file,
    name: file.replace(/\.html$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim(),
    version,
    type: hacked ? 'hacked' : /^(Minecraft|Eaglercraft|Resent|Pixel|Tuff|flame)/i.test(file) ? 'standard' : 'unverified',
    runtime: /wasm/i.test(file) ? 'WASM' : 'JavaScript',
    bytes: size,
    available,
    ...(!available ? { issue: 'This upload is a webpage, not a runnable game client.' } : {})
  };
}

export async function generateCatalog(directory = root) {
  const files = (await readdir(directory)).filter(file => /\.html$/i.test(file)).sort();
  const clients = [];
  for (const file of files) clients.push(await inspectClient(file, directory));
  return { schema: 1, clients };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = await generateCatalog();
  await mkdir(path.join(root, 'data'), { recursive: true });
  await writeFile(path.join(root, 'data/clients.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Cataloged ${catalog.clients.length} uploads. Identical files share one storage key.`);
}
