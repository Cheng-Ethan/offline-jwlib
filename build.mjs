// Cross-platform build: concatenates the local modules into the single HTML
// exactly like build.ps1, but runs on any OS with Node.js (no npm install).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const manifest = JSON.parse(read('project.json'));
if (!manifest.appVersion) throw new Error('project.json has no appVersion');
if (Number(manifest.moduleApiVersion) !== 1) throw new Error('Unsupported module API version: ' + manifest.moduleApiVersion);

let out = read('src/index.template.html');
const css = read('src/styles.css');
const vendor = name => read('src/vendor/' + name);
const categoriesJson = read('src/categories.json');
const modules = [...manifest.modules]
  .sort((a, b) => Number(a.order) - Number(b.order))
  .map(m => {
    if (Number(m.requiresApi) > Number(manifest.moduleApiVersion)) throw new Error('Module requires a newer module API: ' + m.file);
    return read('src/modules/' + m.file);
  })
  .join('\n');

out = out.replace('@@CSS@@', css)
  .replace('@@VENDOR_JSZIP@@', vendor('jszip.js'))
  .replace('@@VENDOR_PAKO@@', vendor('pako.js'))
  .replace('@@VENDOR_SQLITE@@', vendor('sql-wasm.js'))
  .replace('@@CATEGORIES_JSON@@', categoriesJson)
  .replace('@@APP_JS@@', modules)
  .replace('@@APP_VERSION@@', String(manifest.appVersion));

if (out.includes('@@')) throw new Error('Build failed: template contains an unresolved placeholder.');

const write = (rel, data) => {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data, 'utf8');
};
write('offline_library.html', out);
write('dist/offline_library.html', out);
console.log('Build complete:', path.join(root, 'offline_library.html'));
console.log('Version:', manifest.appVersion);
console.log('Size:', Buffer.byteLength(out), 'bytes');
