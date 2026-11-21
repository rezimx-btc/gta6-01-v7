// MARAVELA: NEON TIDE — local dev server (Node 22, standard library only).
// Serves this repository so the game can be playtested in a browser:
//   node serve.ts
//   open http://localhost:8082/game/
//
// The grader never runs this file. The graded entry point is main.ts,
// which is a hand-in program that finishes and exits.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8082;
const ROOT = fileURLToPath(new URL('.', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const cleaned = decoded === '/' ? '/game/index.html' : decoded;
  const resolved = normalize(join(ROOT, cleaned));
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    const file = safePath(req.url || '/');
    if (!file) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    const body = await readFile(file);
    const type = MIME[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(body);
  } catch (err) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found: ' + (req.url || ''));
  }
});

server.listen(PORT, () => {
  console.log('MARAVELA: NEON TIDE dev server at http://localhost:' + PORT + '/game/');
  console.log('WASD move/drive, E enter or carjack, F radio, 1/2/3 crew, P pause, M mute.');
});
