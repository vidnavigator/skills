#!/usr/bin/env node
// Checks the repository before a push: every skill follows the Agent Skills format
// (https://agentskills.io/specification), the manifests are valid JSON and agree on the version,
// and the copies of the CLI are identical. No dependencies.
//
//   node scripts/check.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

// --- Skills ---------------------------------------------------------------

const ALLOWED_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);

// The frontmatter of these skills is flat `key: value` lines, plus one `metadata:` block.
function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) return null;
  const fields = {};
  let block = null;
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const nested = /^\s+([\w-]+):\s*(.*)$/.exec(line);
    const top = /^([\w-]+):\s*(.*)$/.exec(line);
    if (top) {
      block = top[2] === '' ? top[1] : null;
      fields[top[1]] = top[2] === '' ? {} : top[2].replace(/^"(.*)"$/, '$1');
    } else if (nested && block) {
      fields[block][nested[1]] = nested[2].replace(/^"(.*)"$/, '$1');
    } else {
      return { error: `cannot read the line "${line}"` };
    }
  }
  return { fields, body: text.slice(match[0].length) };
}

const skillsDir = join(root, 'skills');
const skills = readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

for (const skill of skills) {
  const where = `skills/${skill}/SKILL.md`;
  const path = join(skillsDir, skill, 'SKILL.md');
  if (!existsSync(path)) {
    fail(where, 'missing');
    continue;
  }
  const text = readFileSync(path, 'utf8');
  const parsed = frontmatter(text);
  if (!parsed) {
    fail(where, 'no frontmatter');
    continue;
  }
  if (parsed.error) {
    fail(where, parsed.error);
    continue;
  }
  const { fields, body } = parsed;

  for (const key of Object.keys(fields)) {
    if (!ALLOWED_KEYS.has(key)) fail(where, `frontmatter key '${key}' is not part of the Agent Skills format`);
  }
  if (fields.name !== skill) fail(where, `name '${fields.name}' must equal the folder name '${skill}'`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(skill) || skill.length > 64) fail(where, 'name must be 1-64 characters of a-z, 0-9 and single hyphens');
  const description = fields.description || '';
  if (typeof description !== 'string' || description.length < 1 || description.length > 1024) {
    fail(where, `description must be 1-1024 characters (it has ${description.length})`);
  }
  if (!/\bUse when\b/.test(description)) fail(where, 'description should say when to use the skill ("Use when ...")');
  if (fields.compatibility && fields.compatibility.length > 500) fail(where, 'compatibility is limited to 500 characters');
  if (!fields.metadata?.version) fail(where, 'metadata.version is missing');
  const lines = body.split(/\r?\n/).length;
  if (lines > 500) fail(where, `the body has ${lines} lines; the format recommends fewer than 500`);

  const usesCli = text.includes('scripts/vn.mjs');
  const hasCli = existsSync(join(skillsDir, skill, 'scripts', 'vn.mjs'));
  if (usesCli && !hasCli) fail(where, 'mentions scripts/vn.mjs but the skill has no copy of it: run node scripts/sync-cli.mjs');
  if (!usesCli && hasCli) fail(where, 'has scripts/vn.mjs but never mentions it');

  // A skill that points to another one must point to a skill that exists.
  for (const [, other] of body.matchAll(/the `([a-z0-9-]+)` skill/g)) {
    if (!skills.includes(other)) fail(where, `refers to a skill '${other}' that does not exist`);
  }
}

// --- CLI copies -----------------------------------------------------------

try {
  execFileSync(process.execPath, [join(root, 'scripts', 'sync-cli.mjs'), '--check'], { stdio: 'pipe' });
} catch (error) {
  fail('scripts/vn.mjs', `${error.stderr || error.message}`.trim());
}
for (const skill of skills) {
  const cli = join(skillsDir, skill, 'scripts', 'vn.mjs');
  if (!existsSync(cli)) continue;
  try {
    execFileSync(process.execPath, ['--check', cli], { stdio: 'pipe' });
  } catch (error) {
    fail(`skills/${skill}/scripts/vn.mjs`, `syntax error: ${error.stderr}`);
  }
}

// --- ChatGPT package ------------------------------------------------------

try {
  execFileSync(process.execPath, [join(root, 'scripts', 'build-chatgpt.mjs'), '--check'], { stdio: 'pipe' });
} catch (error) {
  fail('chatgpt/', `${error.stderr || error.message}`.trim());
}

// --- Manifests ------------------------------------------------------------

function readJson(relative) {
  try {
    return JSON.parse(readFileSync(join(root, relative), 'utf8'));
  } catch (error) {
    fail(relative, `not valid JSON: ${error.message}`);
    return null;
  }
}

const claudePlugin = readJson('.claude-plugin/plugin.json');
const claudeMarketplace = readJson('.claude-plugin/marketplace.json');
const codexPlugin = readJson('.codex-plugin/plugin.json');
const codexMarketplace = readJson('.agents/plugins/marketplace.json');
const registry = existsSync(join(root, 'server.json')) ? readJson('server.json') : null;

if (claudePlugin && codexPlugin) {
  if (claudePlugin.version !== codexPlugin.version) fail('.codex-plugin/plugin.json', `version ${codexPlugin.version} differs from the Claude plugin's ${claudePlugin.version}`);
  if (claudePlugin.name !== codexPlugin.name) fail('.codex-plugin/plugin.json', 'name differs from the Claude plugin');
}
if (claudePlugin && claudeMarketplace && !claudeMarketplace.plugins?.some((plugin) => plugin.name === claudePlugin.name)) {
  fail('.claude-plugin/marketplace.json', `does not list the plugin '${claudePlugin.name}'`);
}
if (codexPlugin && codexMarketplace && !codexMarketplace.plugins?.some((plugin) => plugin.name === codexPlugin.name)) {
  fail('.agents/plugins/marketplace.json', `does not list the plugin '${codexPlugin.name}'`);
}
if (claudePlugin?.icon && !existsSync(join(root, claudePlugin.icon))) fail('.claude-plugin/plugin.json', `icon ${claudePlugin.icon} not found`);
if (registry && (registry.description || '').length > 100) fail('server.json', 'description is limited to 100 characters');

for (const skill of skills) {
  const version = frontmatter(readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8'))?.fields?.metadata?.version;
  if (claudePlugin && version && version !== claudePlugin.version) fail(`skills/${skill}/SKILL.md`, `metadata.version ${version} differs from the plugin's ${claudePlugin.version}`);
}

// --- README ---------------------------------------------------------------

const readme = readFileSync(join(root, 'README.md'), 'utf8');
for (const skill of skills) {
  if (!readme.includes(`skills/${skill}/SKILL.md`)) fail('README.md', `does not list the skill '${skill}'`);
}

if (problems.length) {
  console.error(problems.map((problem) => `✗ ${problem}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${skills.length} skills, manifests and CLI copies are consistent.`);
