import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { build } from 'vite';
import { generatePlannerMetadata } from './planner-metadata.mjs';
import { generateBonusCurrencyIcons } from './bonus-currency-icons.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, '.generated-static');
const content = join(root, '.generated-content');
const documentNames = ['credit', 'privacy', 'changelog'];
const migratedNames = [...documentNames, 'debug'];
const reviewedOldEventIds = ['on-your-mark', 'hot-spring-rerun', 'restoration-project', 'on-your-mark-rerun', 'valentine-rerun'];
const supportedTags = new Set([
  'div', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'br', 'a',
  'strong', 'b', 'em', 'i', 'span', 'code'
]);

function findContent(node) {
  if (node.attrs?.some((attr) => attr.name === 'class' && attr.value.split(/\s+/).includes('bodyText'))) {
    return node;
  }
  for (const child of node.childNodes ?? []) {
    const found = findContent(child);
    if (found) return found;
  }
}

function convertNode(node) {
  if (node.nodeName === '#text') return { type: 'text', text: node.value };
  if (node.nodeName === '#comment') return null;
  if (!supportedTags.has(node.tagName)) {
    throw new Error(`Unsupported documentation element: ${node.tagName}`);
  }
  const attributes = {};
  for (const attr of node.attrs ?? []) {
    if (!['class', 'href', 'target', 'rel', 'style'].includes(attr.name)) {
      throw new Error(`Unsupported documentation attribute: ${attr.name}`);
    }
    attributes[attr.name] = attr.value;
  }
  return {
    type: 'element',
    tag: node.tagName,
    attributes,
    children: node.childNodes.map(convertNode).filter(Boolean)
  };
}

async function disableImageDraggingInHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await disableImageDraggingInHtml(path);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) continue;

    const html = await readFile(path, 'utf8');
    if (html.includes('/planner/js/no-image-drag.js')) continue;
    const script = '  <script src="/planner/js/no-image-drag.js" defer></script>\n';
    const withScript = html.replace(/<\/head>/i, `${script}</head>`);
    if (withScript === html) throw new Error(`Could not add image drag handling to ${path}: missing </head>.`);
    await writeFile(path, withScript);
  }
}

function compatibilityPage(name) {
  const destination = `/planner/${name}/`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${destination}">
<link rel="canonical" href="${destination}">
<title>Page moved</title>
<script>location.replace(${JSON.stringify(destination)} + location.search + location.hash);</script>
</head><body><a href="${destination}">Continue to ${name}</a></body></html>\n`;
}

await rm(assets, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
// Keep generated modules in place while refreshing them. `prepare:site` is also
// used by `check` and `build`, and deleting this directory first can make a
// concurrently running Vite dev server fail to resolve imports such as
// `$content/changelog`.
await mkdir(content, { recursive: true });
await generatePlannerMetadata(root, join(content, 'planner.ts'));
await cp(join(root, 'planner', 'json', 'strings.json'), join(content, 'strings.json'));
const oldEvents = JSON.parse(await readFile(join(root, 'planner', 'json', 'old_events.json'), 'utf8'));
if (!oldEvents || typeof oldEvents !== 'object' || !oldEvents.events || typeof oldEvents.events !== 'object') {
  throw new Error('Archived event data must contain an events object.');
}
const reviewedOldEvents = {};
for (const id of reviewedOldEventIds) {
  const event = oldEvents.events[id];
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error(`Missing reviewed archived event ${id}.`);
  reviewedOldEvents[id] = event;
}
await writeFile(join(content, 'reviewed-event-archive.json'), `${JSON.stringify({ events: reviewedOldEvents }, null, 2)}\n`);
const aliases = JSON.parse(await readFile(join(root, 'planner', 'json', 'student_info.json'), 'utf8'));
if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) throw new Error('Manual search aliases must be an object.');
for (const [id, languages] of Object.entries(aliases)) {
  if (!languages || typeof languages !== 'object' || Array.isArray(languages) ||
    Object.values(languages).some((names) => !Array.isArray(names) || names.some((name) => typeof name !== 'string' || !name.trim()))) {
    throw new Error(`Invalid manual search aliases for ${id}.`);
  }
}
await cp(join(root, 'planner', 'json', 'student_info.json'), join(content, 'search-aliases.json'));

for (const name of ['favicon.ico', 'index.html', 'game']) {
  await cp(join(root, name), join(assets, name), { recursive: true });
}
await mkdir(join(assets, 'planner'), { recursive: true });
for (const entry of await readdir(join(root, 'planner'), { withFileTypes: true })) {
  if (migratedNames.some((name) => entry.name === `${name}.html`)) continue;
  await cp(join(root, 'planner', entry.name), join(assets, 'planner', entry.name), { recursive: true });
}
await generateBonusCurrencyIcons(
  join(root, 'planner', 'icons', 'EventIcon', 'CurrencyIcon'),
  join(assets, 'planner', 'icons', 'EventIcon', 'BonusCurrencyIcon')
);

const titles = { credit: 'Credits', privacy: 'Privacy Policy', changelog: 'Changelog' };
for (const name of documentNames) {
  const source = await readFile(join(root, 'planner', `${name}.html`), 'utf8');
  const body = findContent(parse(source));
  if (!body) throw new Error(`Missing documentation content in ${name}.html`);
  const document = {
    title: titles[name],
    content: body.childNodes.map(convertNode).filter(Boolean)
  };
  await writeFile(
    join(content, `${name}.ts`),
    `import type { StaticDocument } from '../src/lib/types/content';\n\n` +
    `export const document: StaticDocument = ${JSON.stringify(document, null, 2)};\n`
  );
}

for (const name of migratedNames) {
  await writeFile(join(assets, 'planner', `${name}.html`), compatibilityPage(name));
}
await disableImageDraggingInHtml(assets);
const redirects = await readFile(join(root, '_redirects'), 'utf8');
await writeFile(
  join(assets, '_redirects'),
  `${redirects.trimEnd()}\n${migratedNames.map((name) => `/planner/${name}.html /planner/${name}/ 301`).join('\n')}\n`
);
for (const name of ['resources', 'simulations', 'student-search', 'events']) {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'error',
    build: {
      lib: {
        entry: join(root, 'src', 'lib', 'legacy', `${name}.ts`),
        name: `BA${name.replaceAll('-', '')}Bridge`,
        formats: ['iife'],
        fileName: () => `${name}.js`
      },
      outDir: join(assets, 'planner', 'js', 'shared'),
      emptyOutDir: false
    }
  });
}
for (const name of ['gear-farm', 'event-plan', 'card-statistics']) {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: 'error',
    build: {
      lib: {
        entry: join(root, 'src', 'lib', 'workers', `${name}.ts`),
        formats: ['iife'], name: 'BAPlannerWorker', fileName: () => `${name}-worker.js`
      },
      outDir: join(assets, 'planner', 'js', 'shared'), emptyOutDir: false
    }
  });
}
console.log('Prepared legacy assets and prerendered documentation content.');
