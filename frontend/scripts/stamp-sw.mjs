/**
 * Stamps the service worker with this build
 *
 * Purpose : Gives every export its own cache name, so a browser can tell one build from the next.
 * Spec    : Section 6.6
 * Look here when : A deploy never reaches the shop, or the "new version ready" bar never appears.
 *
 * A browser decides whether a service worker is new by comparing the bytes of sw.js. Ours did not
 * change between builds, so no update was ever detected and a till kept serving the version it had
 * cached -- the exact failure the update bar exists to prevent. The placeholder is replaced in
 * dist/ only, so public/sw.js stays as it is in git rather than being dirtied by every build.
 */
import fs from 'node:fs';

const file = 'dist/sw.js';
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

if (!fs.existsSync(file)) {
  console.error('stamp-sw: no dist/sw.js — run the export first');
  process.exit(1);
}

const source = fs.readFileSync(file, 'utf8');
if (!source.includes('__BUILD__')) {
  console.error('stamp-sw: dist/sw.js has no __BUILD__ placeholder');
  process.exit(1);
}

fs.writeFileSync(file, source.replace('__BUILD__', stamp));
console.log(`stamp-sw: cache is inventix-till-${stamp}`);
