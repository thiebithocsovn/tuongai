import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const manifest = JSON.parse(read('manifest.webmanifest'));
const worker = read('service-worker.js');
const android = read('native/android/app/src/main/AndroidManifest.xml');
const java = read('native/android/app/src/main/java/vn/tuonghoctap/ai/MainActivity.java');
const win = JSON.parse(read('native/windows/package.json'));
const winMain = read('native/windows/main.cjs');

assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
for (const marker of ['id="auth"','id="f-login"','id="f-reg"','id="install-panel"','id="install-native"','id="install-main"','id="install-download-state"']) {
  assert.ok(html.includes(marker), 'Missing UI: ' + marker);
}
for (const target of ['android','ios','windows','mac']) {
  assert.ok(html.includes('data-install-os="' + target + '"'), 'Missing install guide: ' + target);
}
for (const bp of [760,480,355]) {
  assert.ok(html.includes('@media(max-width:' + bp + 'px)'), 'Missing responsive viewport ' + bp);
}
assert.ok(html.includes('https://thiebithocsovn.github.io/tuongai/'));
assert.equal(manifest.start_url, '/tuongai/');
assert.equal(manifest.scope, '/tuongai/');
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.some(x => x.sizes === '192x192'));
assert.ok(manifest.icons.some(x => x.sizes === '512x512'));
for (const asset of ['offline.html','app-icon.svg','icon-180.png','icon-192.png','icon-512.png']) {
  assert.ok(fs.existsSync(path.join(root, asset)), 'Missing PWA asset ' + asset);
  assert.ok(worker.includes('/tuongai/' + asset), 'Service worker missing ' + asset);
}
assert.ok(!worker.includes("'/tuongai/index.html'"), 'Do not cache private app shell');
assert.match(android, /android:usesCleartextTraffic="false"/);
assert.match(android, /androidx\.core\.content\.FileProvider/);
assert.match(java, /https:\/\/thiebithocsovn\.github\.io\/tuongai\//);
assert.match(java, /onShowFileChooser/);
assert.equal(win.build.win.target[0].target, 'nsis');
assert.match(winMain, /nodeIntegration: false/);
assert.match(winMain, /sandbox: true/);

let count = 0;
for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
  if (!match[1].trim()) continue;
  new vm.Script(match[1], { filename: 'inline-' + ++count + '.js' });
}
assert.ok(count >= 2);
console.log('PASS: responsive login, valid PWA manifest/assets, installer setup and ' + count + ' inline JS blocks.');
