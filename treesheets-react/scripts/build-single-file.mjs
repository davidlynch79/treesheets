import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDirectory = resolve('dist');
const inputPath = resolve(distDirectory, 'index.html');
const outputPath = resolve(distDirectory, 'treesheets-standalone.html');
let html = await readFile(inputPath, 'utf8');

function assetPath(source) {
  const pathname = new URL(source, 'https://vite.local').pathname;
  return resolve(distDirectory, `.${decodeURIComponent(pathname)}`);
}

const scriptTags = [...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/g)];
const stylesheetTags = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*>/g)];

if (scriptTags.length !== 1 || stylesheetTags.length !== 1) {
  throw new Error(`Expected one JavaScript bundle and one stylesheet; found ${scriptTags.length} and ${stylesheetTags.length}.`);
}

for (const [tag, , source] of scriptTags) {
  const javascript = (await readFile(assetPath(source), 'utf8')).replace(/<\/script/gi, '<\\/script');
  html = html.replace(tag, () => `<script type="module">\n${javascript}\n</script>`);
}

for (const [tag] of stylesheetTags) {
  const source = tag.match(/\bhref="([^"]+)"/)?.[1];
  if (!source) throw new Error('Vite stylesheet link has no href.');
  const css = await readFile(assetPath(source), 'utf8');
  html = html.replace(tag, () => `<style>\n${css}\n</style>`);
}

await writeFile(outputPath, html);
console.log(`Created ${outputPath}`);