// YoRHa Terminal -- copies the wallpaper into the GitHub repo folder (../YoRHaTerminal-GitHub by default).
//   node tools/sync-github.mjs [dest]
// The repo gets the runtime files, translations and dev tools, but never the NieRCharacters renders:
// its bundled.js is written with an empty list, so the live demo asks for no images it does not have.
// project.json comes from the installed Wallpaper Engine project when it exists (that copy is the source
// of truth). README.md, .nojekyll and .git in the repo folder are left alone. Also builds YoRHaHelper.zip.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.resolve(process.argv[2] || path.join(ROOT, '..', 'YoRHaTerminal-GitHub'));
const INSTALLED = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\wallpaper_engine\\projects\\myprojects\\yorha_terminal';

const list = ['index.html', 'style.css', 'i18n.js', 'main.js', 'games.js', 'breach3d.js', 'planner.js', 'podlines.js', 'preview.gif'];
for (const dir of ['lang', 'i18n', 'vendor', 'tools', 'helper']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (fs.statSync(path.join(ROOT, dir, f)).isFile()) list.push(dir + '/' + f);
  }
}

for (const f of list) {
  fs.mkdirSync(path.dirname(path.join(DEST, f)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), path.join(DEST, f));
}

const installedJson = path.join(INSTALLED, 'project.json');
fs.copyFileSync(fs.existsSync(installedJson) ? installedJson : path.join(ROOT, 'project.json'), path.join(DEST, 'project.json'));

fs.writeFileSync(path.join(DEST, 'bundled.js'),
  '/* YoRHa Terminal -- GitHub copy: no character set ships here (tools/sync-github.mjs). Point the\n' +
  '   Character folder property at your own images, or use #charfiles=a.png|b.png in the demo URL. */\n' +
  'window.YoRHaBundled = ' + JSON.stringify({ folder: 'NieRCharacters', files: [] }, null, 1) + ';\n');

console.log('[OK] ' + (list.length + 2) + ' files -> ' + DEST);

// YoRHaHelper.zip: the helper folder as one download (the README and the wallpaper's SYSTEM > YORHA HELPER
// page link to it). Built with Windows' own tar, which writes .zip files.
const zip = path.join(DEST, 'YoRHaHelper.zip');
if (fs.existsSync(zip)) fs.unlinkSync(zip);
const helperFiles = fs.readdirSync(path.join(ROOT, 'helper')).filter((f) => fs.statSync(path.join(ROOT, 'helper', f)).isFile());
execFileSync(path.join(process.env.SystemRoot || 'C:\Windows', 'System32', 'tar.exe'), ['-a', '-c', '-f', zip, '-C', path.join(ROOT, 'helper')].concat(helperFiles));
console.log('[OK] YoRHaHelper.zip: ' + helperFiles.join(', '));
