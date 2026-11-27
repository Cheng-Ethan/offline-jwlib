import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
let failed = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log('PASS', name);
  } else {
    failed++;
    console.error('FAIL', name, detail);
  }
}

const manifest = JSON.parse(read('project.json'));
check('appVersion is semver', /^\d+\.\d+\.\d+$/.test(manifest.appVersion), manifest.appVersion);
check('moduleApiVersion is 1', Number(manifest.moduleApiVersion) === 1);
check('indexedDbVersion is 5', Number(manifest.indexedDbVersion) === 5);
check('backupFormat is v2', manifest.backupFormat === 'offline-library-library-v2');

const modules = [...manifest.modules].sort((a, b) => Number(a.order) - Number(b.order));
check('module list is not empty', modules.length > 0);
for (const mod of modules) {
  check(`module exists: ${mod.file}`, exists(`src/modules/${mod.file}`));
}
const sources = modules.map(mod => read(`src/modules/${mod.file}`));
const combined = sources.join('\n');
try {
  new vm.Script(combined);
  check('modules parse as one script', true);
} catch (error) {
  check('modules parse as one script', false, error.message);
}
const appVersionLine = `const APP_VERSION='${manifest.appVersion}';`;
check('runtime APP_VERSION matches project.json', combined.includes(appVersionLine));

const template = read('src/index.template.html');
for (const placeholder of ['@@CSS@@', '@@VENDOR_JSZIP@@', '@@VENDOR_PAKO@@', '@@VENDOR_SQLITE@@', '@@CATEGORIES_JSON@@', '@@APP_JS@@', '@@APP_VERSION@@']) {
  check(`template has ${placeholder}`, template.includes(placeholder));
}
check('template has Content-Security-Policy', template.includes('Content-Security-Policy'));

check('main HTML exists', exists('offline_library.html'));
check('dist HTML exists', exists('dist/offline_library.html'));
if (exists('offline_library.html') && exists('dist/offline_library.html')) {
  const main = read('offline_library.html');
  const dist = read('dist/offline_library.html');
  check('main and dist hashes match', sha(main) === sha(dist));
  check('built HTML has current version meta', main.includes(`name="offline-library-version" content="${manifest.appVersion}"`));
  check('built HTML has no unresolved placeholders', !main.includes('@@'));
  check('built HTML has no external script src', !/<script[^>]+src=["']https?:/i.test(main));
  check('built HTML has no external stylesheet link', !/<link[^>]+href=["']https?:/i.test(main));
  check('built HTML has no external image src', !/<img[^>]+src=["']https?:/i.test(main));
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll build checks passed.');
