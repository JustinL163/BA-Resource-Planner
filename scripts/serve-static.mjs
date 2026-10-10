import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'build');
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg'
};
const redirects = (await readFile(join(root, '_redirects'), 'utf8'))
  .split(/\r?\n/)
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => line.trim().split(/\s+/));
const legacyAliases = new Map(
  ['events', 'tournaments'].flatMap((name) => [
    [`/planner/${name}`, `/planner/${name}.html`],
    [`/planner/${name}/`, `/planner/${name}.html`]
  ])
);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const alias = legacyAliases.get(url.pathname);
    if (alias) {
      response.writeHead(302, { Location: alias + url.search });
      response.end();
      return;
    }
    const redirect = redirects.find(([from]) => from === url.pathname);
    if (redirect) {
      response.writeHead(Number(redirect[2]), { Location: redirect[1] + url.search });
      response.end();
      return;
    }
    const file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    let target = file;
    let info = await stat(target);
    if (info.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        response.writeHead(308, { Location: url.pathname + '/' + url.search });
        response.end();
        return;
      }
      target = join(target, 'index.html');
      info = await stat(target);
    }
    if (!info.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': types[extname(target)] ?? 'application/octet-stream' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(target).pipe(response);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      response.writeHead(404).end('Not found');
    } else {
      console.error(error);
      response.writeHead(500).end('Unable to serve file');
    }
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Static preview: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close());
}
