// YoRHa Terminal -- keep translation files aligned after the English catalog changes.
//   node tools/migrate_i18n.mjs <old en.txt>
// Diffs the old catalog against the current i18n/en.txt section by section, then removes the lines
// that disappeared from every i18n/<code>.txt and inserts new English lines marked "@@TODO " so the
// build fails until they are translated.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sections(text) {
  const out = new Map();
  let cur = null;
  const head = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.startsWith('## ')) { cur = raw.slice(3).trim(); out.set(cur, []); continue; }
    if (!cur) { head.push(raw); continue; }
    if (!raw.trim() || raw.startsWith('# ')) continue;
    out.get(cur).push(raw);
  }
  return { head, out };
}

// Longest common subsequence edit script: [['=', i, j] | ['-', i] | ['+', j]]
function diff(a, b) {
  const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push(['=', i++, j++]); } else if (L[i + 1][j] >= L[i][j + 1]) { ops.push(['-', i++]); } else { ops.push(['+', j++]); }
  }
  while (i < n) ops.push(['-', i++]);
  while (j < m) ops.push(['+', j++]);
  return ops;
}

const oldEn = sections(fs.readFileSync(process.argv[2], 'utf8')).out;
const newEn = sections(fs.readFileSync(path.join(ROOT, 'i18n', 'en.txt'), 'utf8')).out;
for (const f of fs.readdirSync(path.join(ROOT, 'i18n')).filter((x) => /^[a-z]{2}\.txt$/.test(x) && x !== 'en.txt')) {
  const tr = sections(fs.readFileSync(path.join(ROOT, 'i18n', f), 'utf8'));
  let text = tr.head.join('\n').replace(/\s+$/, '') + '\n';
  let removed = 0, added = 0;
  for (const [name, lines] of newEn) {
    const before = oldEn.get(name) || [];
    const have = tr.out.get(name) || [];
    const next = [];
    const ops = diff(before, lines);
    // A line that only moved inside its section keeps its translation.
    const moved = new Map();
    for (const op of ops) if (op[0] === '-' && have[op[1]] !== undefined) moved.set(before[op[1]], have[op[1]]);
    for (const op of ops) {
      if (op[0] === '=') next.push(have[op[1]]);
      else if (op[0] === '-') removed++;
      else if (moved.has(lines[op[1]])) { next.push(moved.get(lines[op[1]])); removed--; }
      else { next.push('@@TODO ' + lines[op[1]]); added++; }
    }
    text += '\n## ' + name + '\n' + next.join('\n') + '\n';
  }
  fs.writeFileSync(path.join(ROOT, 'i18n', f), text);
  console.log('[OK] ' + f + ': ' + removed + ' removed, ' + added + ' to translate');
}
