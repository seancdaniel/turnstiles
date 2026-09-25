// Copies the site into app/www, which is what Capacitor bundles into the
// iOS app. The site has no build step, so this is a plain copy of the
// files a browser actually loads.
//
// An allowlist, not "everything except": api/, supabase/, tools/, NOTES.md
// and the rest of the repo have no business inside the app bundle, and a
// new top-level file should not ship until somebody decides it should.
import { cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const out = join(here, 'www');

rmSync(out, { recursive: true, force: true });
mkdirSync(out);

const files = ['index.html', 'styles.css', 'manifest.json',
  ...readdirSync(site).filter(f => f.endsWith('.js'))];
for (const f of files) cpSync(join(site, f), join(out, f));
cpSync(join(site, 'img'), join(out, 'img'), { recursive: true });

console.log('www: ' + files.length + ' files + img/');
