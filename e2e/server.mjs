import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from '../scripts/catalog.mjs';
import { catalog, game } from './fixtures.mjs';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/catalog.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(catalog));
    return;
  }
  if (pathname.startsWith('/fixtures/')) {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(game);
    return;
  }
  try {
    const file = path.join(root, 'public', pathname === '/' ? 'index.html' : pathname);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
    res.writeHead(404).end('Not found');
  }
}).listen(4173);
