// Serves the built app (dist/) for the always-on deployment. No dependencies; run `npm run build` first.
// Listens only on this computer by default; Tailscale Funnel makes it reachable from outside.
// WARDROBE_HOST and WARDROBE_PORT change where it listens.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { DENIED_HTML, DENIED_JSON, checkAccess, manifestWithKey, readAccessKey } from './access-key.js';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const host = process.env.WARDROBE_HOST || '127.0.0.1';
const port = Number(process.env.WARDROBE_PORT) || 5180;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  // Access-key lock (see access-key.js). Read on every request, so a new key needs no restart.
  const key = readAccessKey();
  let decision;
  try {
    decision = checkAccess({ url: new URL(req.url, `http://${req.headers.host || 'localhost'}`).href, headers: req.headers }, key);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (decision.action === 'redirect') {
    res.writeHead(302, { Location: decision.location, 'Set-Cookie': decision.setCookie, 'Cache-Control': 'no-store' }).end();
    return;
  }
  if (decision.action === 'deny') {
    res
      .writeHead(401, {
        'Content-Type': decision.json ? 'application/json' : 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      .end(req.method === 'HEAD' ? undefined : decision.json ? DENIED_JSON : DENIED_HTML);
    return;
  }

  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (key && path === '/manifest.json') {
    try {
      const manifest = manifestWithKey(JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')), key);
      res.writeHead(200, { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'private, no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(manifest));
    } catch {
      res.writeHead(404).end();
    }
    return;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(root, '.' + sep + normalize(path));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  let info;
  try {
    info = await stat(file);
  } catch {
    info = null;
  }
  if (!info?.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  const hashed = file.startsWith(join(root, 'assets') + sep);
  res.writeHead(200, {
    'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': info.size,
    // Files in assets/ have content hashes in their names, so they never change; everything else is re-checked.
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
}).listen(port, host, () => {
  console.log(`Wardrobe is served at http://${host}:${port}/`);
});
