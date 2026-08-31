// services/admin-dashboard/scripts/check-rsc-boundary.mjs
//
// Catches: a SERVER component importing a plain function or value from a
// 'use client' module. React allows a server component to render a client
// COMPONENT, but calling a client function from the server throws at request
// time ("Attempted to call X() from the server").
//
// This exists because neither tsc nor vitest nor `next build` catches it. The
// pages here are server-rendered on demand, so the build never renders them
// and exits 0 with the bug present. It reached production on 2026-08-31.
//
// Heuristic: a named import starting with a lowercase letter is a function or
// value, not a component. Uppercase names and `import type` are allowed.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "src", "components"];
const EXT = ['.ts', '.tsx'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.some((e) => entry.endsWith(e)) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.filter((d) => { try { return statSync(join(ROOT, d)).isDirectory(); } catch { return false; } })
  .flatMap((d) => walk(join(ROOT, d)));

const source = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const isClient = (f) => /^\s*['"]use client['"]/m.test(source.get(f) ?? '');

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const cand of [...EXT.map((e) => base + e), ...EXT.map((e) => join(base, 'index' + e))]) {
    if (source.has(cand)) return cand;
  }
  return null;
}

const violations = [];
for (const [file, text] of source) {
  if (isClient(file)) continue; // server components only
  const re = /import\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) continue; // import type
    const target = resolveImport(file, m[3]);
    if (!target || !isClient(target)) continue;
    for (let name of m[2].split(',')) {
      name = name.trim().split(/\s+as\s+/)[0].trim();
      if (!name || name.startsWith('type ')) continue;
      if (/^[a-z]/.test(name)) {
        violations.push({ file: file.replace(ROOT + '/', ''), name, from: m[3] });
      }
    }
  }
}

if (violations.length) {
  console.error('RSC boundary violations (server component calling a client export):\n');
  for (const v of violations) {
    console.error(`  ${v.file}: imports { ${v.name} } from '${v.from}' which is 'use client'`);
  }
  console.error('\nMove the shared function into a plain module with no "use client".');
  process.exit(1);
}
console.log('rsc-boundary: clean');
