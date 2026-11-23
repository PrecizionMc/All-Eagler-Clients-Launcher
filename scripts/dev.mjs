import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { root } from './catalog.mjs';

const catalog = JSON.parse(await readFile(path.join(root, 'data/clients.json'), 'utf8'));
const clients = new Map(catalog.clients.map(client => [client.id, client]));
const localCatalog = {
  ...catalog,
  local: true,
  clients: catalog.clients.map(client => ({ ...client, url: client.available ? `/clients/${client.id}.html` : null }))
};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/catalog.json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(localCatalog));
      return;
    }
    const id = pathname.match(/^\/clients\/([a-f0-9]{64})\.html$/)?.[1];
    const client = id && clients.get(id);
    const filename = client ? path.join(root, client.file) : path.resolve(root, 'public', `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!client && !filename.startsWith(path.join(root, 'public') + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(filename);
    if (!info.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store'
    });
    const stream = createReadStream(filename);
    stream.on('error', error => { console.error(error); res.destroy(error); });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') res.writeHead(404).end('Not found');
    else { console.error(error); res.writeHead(500).end('Server error'); }
  }
});
server.listen(Number(process.env.PORT ?? 3000), '0.0.0.0', () => {
  console.log(`Eagler Vault: http://localhost:${server.address().port}`);
});
