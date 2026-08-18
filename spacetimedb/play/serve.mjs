/**
 * Bundles the play page and serves it. No dependencies beyond esbuild, which the project already
 * has, so this needs no install step of its own.
 *
 *   node spacetimedb/play/serve.mjs          # http://127.0.0.1:4000
 *   node spacetimedb/play/serve.mjs 4100     # a second instance on another port
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as esbuild from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? 4000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

// Rebuild on every load, so editing main.ts only needs a browser refresh.
const context = await esbuild.context({
  entryPoints: [join(here, 'main.ts')],
  outfile: join(here, 'bundle.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'warning',
});

async function rebuild() {
  try {
    await context.rebuild();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const firstError = await rebuild();
if (firstError) {
  console.error(firstError);
  process.exit(1);
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  const name = url.pathname === '/' ? '/index.html' : url.pathname;
  // Keep the served files inside this directory.
  const path = join(here, normalize(name).replace(/^([/\\])+/, ''));

  if (name === '/index.html' || name === '/bundle.js') {
    const error = await rebuild();
    if (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error);
      return;
    }
  }

  try {
    const body = await readFile(path);
    response.writeHead(200, {
      'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`play the L Game at http://127.0.0.1:${port}`);
  console.log('open it in two tabs to play against yourself');
});
