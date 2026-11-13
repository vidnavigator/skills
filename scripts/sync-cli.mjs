#!/usr/bin/env node
// A skill is installed as one folder, so each skill that calls VidNavigator carries its own copy of
// the CLI. This copies skills/watch/scripts/vn.mjs into the other skills.
//
//   node scripts/sync-cli.mjs           copy
//   node scripts/sync-cli.mjs --check   fail if a copy differs (used by the tests)

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'skills', 'watch', 'scripts', 'vn.mjs');
const check = process.argv.includes('--check');

// The skills that call the CLI are those whose SKILL.md mentions it.
const targets = readdirSync(join(root, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'watch')
  .filter((entry) => readFileSync(join(root, 'skills', entry.name, 'SKILL.md'), 'utf8').includes('scripts/vn.mjs'))
  .map((entry) => join(root, 'skills', entry.name, 'scripts', 'vn.mjs'));

const wanted = readFileSync(source);
let stale = 0;
for (const target of targets) {
  const same = existsSync(target) && readFileSync(target).equals(wanted);
  if (same) continue;
  stale++;
  if (check) {
    console.error(`Out of date: ${target}`);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    console.log(`Updated ${target}`);
  }
}

if (check && stale) {
  console.error('Run: node scripts/sync-cli.mjs');
  process.exit(1);
}
console.log(check ? `${targets.length} copies up to date.` : `${targets.length} copies, ${stale} updated.`);
