import { createHash } from 'node:crypto';

export const game = '<!doctype html><html><head><title>Fixture game</title></head><body><h1>Offline game launched</h1></body></html>';
const id = createHash('sha256').update(game).digest('hex');
export const catalog = {
  clients: [
    { id, name: 'Dragon Test', version: '1.8.8', type: 'hacked', runtime: 'JavaScript', bytes: Buffer.byteLength(game), available: true, url: '/fixtures/game.html' },
    { id, name: 'Dragon Duplicate', version: '1.8.8', type: 'hacked', runtime: 'JavaScript', bytes: Buffer.byteLength(game), available: true, url: '/fixtures/game.html' },
    { id: 'b'.repeat(64), name: 'Pixel Test', version: '1.12.2', type: 'standard', runtime: 'WASM', bytes: Buffer.byteLength(game), available: true, url: '/fixtures/pixel.html' },
    { id: 'c'.repeat(64), name: 'Invalid Upload', version: '1.14', type: 'unverified', runtime: 'JavaScript', bytes: 50, available: false, issue: 'Not a game client.' }
  ]
};
