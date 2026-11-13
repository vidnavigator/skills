#!/usr/bin/env node
// Builds the package submitted to the ChatGPT plugin directory (platform.openai.com/plugins) from
// chatgpt/: plugin.json, mcp.json and the icons they reference, in a ZIP. It checks the package
// against the limits of OpenAI's submission guide first.
//
//   node scripts/build-chatgpt.mjs           check, then write dist/vidnavigator-chatgpt-<version>.zip
//   node scripts/build-chatgpt.mjs --check   check only, offline, and accept the demo video placeholder
//
// Needs Node.js 22 or later (zlib.crc32).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(root, 'chatgpt');
const checkOnly = process.argv.includes('--check');
const MCP_URL_FOR_TOOLS = process.env.VIDNAVIGATOR_MCP_URL || null;

const problems = [];
const fail = (where, message) => problems.push(`chatgpt/${where}: ${message}`);

function readJson(name) {
  try {
    return JSON.parse(readFileSync(join(packageDir, name), 'utf8'));
  } catch (error) {
    fail(name, `not readable JSON: ${error.message}`);
    return null;
  }
}

const isHttps = (value) => typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value) && value.length <= 1024;
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

function pngSize(path) {
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// --- plugin.json -------------------------------------------------------------

const plugin = readJson('plugin.json');
const mcp = readJson('mcp.json');
const files = new Set(['plugin.json', 'mcp.json']);

if (plugin) {
  if (plugin.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') fail('plugin.json', '$schema must be the Agent Plugins 1.0.0 schema');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(plugin.name || '') || plugin.name.length > 64) fail('plugin.json', 'name: lowercase letters, digits and single hyphens, at most 64');
  if (!/^\d+\.\d+\.\d+$/.test(plugin.version || '')) fail('plugin.json', 'version must be x.y.z');
  if (!text(plugin.description, 4000)) fail('plugin.json', 'description: 1 to 4000 characters');
  if (!text(plugin.author?.name, 120)) fail('plugin.json', 'author.name: 1 to 120 characters');

  const openai = plugin.extensions?.['com.openai'] || {};
  const ui = openai.interface || {};
  const limits = { displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80, category: 80 };
  for (const [field, max] of Object.entries(limits)) {
    if (!text(ui[field], max)) fail('plugin.json', `interface.${field}: 1 to ${max} characters (has ${ui[field]?.length ?? 0})`);
  }
  for (const field of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    if (!isHttps(ui[field])) fail('plugin.json', `interface.${field} must be an https URL`);
  }
  if (!Array.isArray(ui.capabilities) || ui.capabilities.length > 20 || ui.capabilities.some((c) => !text(c, 120))) {
    fail('plugin.json', 'interface.capabilities: at most 20 labels of at most 120 characters');
  }
  if (ui.defaultPrompt && (!Array.isArray(ui.defaultPrompt) || ui.defaultPrompt.length > 3 || ui.defaultPrompt.some((p) => !text(p, 128)))) {
    fail('plugin.json', 'interface.defaultPrompt: at most 3 prompts of at most 128 characters');
  }
  for (const field of ['logo', 'composerIcon']) {
    const relative = ui[field];
    if (typeof relative !== 'string' || !relative.startsWith('./')) {
      fail('plugin.json', `interface.${field} must be a ./ path to a file of the package`);
      continue;
    }
    const path = join(packageDir, normalize(relative));
    if (!path.startsWith(packageDir) || !existsSync(path)) {
      fail('plugin.json', `interface.${field}: ${relative} not found`);
      continue;
    }
    const size = pngSize(path);
    if (!size || size.width !== size.height || size.width < 48 || size.width > 4096) fail(relative, 'icons must be square PNG images, 48 to 4096 pixels');
    files.add(relative.slice(2));
  }

  const review = openai.review || {};
  const positive = review.test_cases?.positive || [];
  const negative = review.test_cases?.negative || [];
  if (positive.length !== 5) fail('plugin.json', `review: exactly 5 positive test cases (has ${positive.length})`);
  if (negative.length !== 3) fail('plugin.json', `review: exactly 3 negative test cases (has ${negative.length})`);
  positive.forEach((testCase, index) => {
    for (const field of ['description', 'prompt', 'expected_behavior']) {
      if (!text(testCase[field], 4000)) fail('plugin.json', `positive test case ${index + 1}: ${field} is missing`);
    }
    if (!Array.isArray(testCase.tools_triggered) || !testCase.tools_triggered.length) fail('plugin.json', `positive test case ${index + 1}: tools_triggered is missing`);
  });
  negative.forEach((testCase, index) => {
    for (const field of ['description', 'prompt']) {
      if (!text(testCase[field], 4000)) fail('plugin.json', `negative test case ${index + 1}: ${field} is missing`);
    }
  });
  if (!isHttps(review.demo_recording_url) && !checkOnly) {
    fail('plugin.json', 'review.demo_recording_url: put the https link to the demo video before building the ZIP');
  }

  // The tools named in the test cases must be tools the server serves.
  if (!checkOnly) {
    const url = MCP_URL_FOR_TOOLS || mcp?.mcpServers?.vidnavigator?.url;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        signal: AbortSignal.timeout(30_000),
      });
      const tools = new Set(((await response.json()).result?.tools || []).map((tool) => tool.name));
      for (const testCase of positive) {
        for (const name of testCase.tools_triggered || []) {
          if (!tools.has(name)) fail('plugin.json', `test case "${testCase.description}": the server has no tool ${name}`);
        }
      }
    } catch (error) {
      fail('mcp.json', `could not list the tools of ${url}: ${error.message}`);
    }
  }
}

// --- mcp.json ----------------------------------------------------------------

if (mcp) {
  const servers = Object.entries(mcp.mcpServers || {});
  if (mcp.$schema !== 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json') fail('mcp.json', '$schema must be the Agent Plugins 1.0.0 MCP schema');
  if (servers.length !== 1) fail('mcp.json', 'exactly one MCP server');
  for (const [name, server] of servers) {
    if (server.type !== 'streamable-http' || !isHttps(server.url)) fail('mcp.json', `${name}: a streamable-http server with an https url`);
    if (server.headers && Object.keys(server.headers).length) fail('mcp.json', `${name}: public submission refuses server headers`);
    const auth = server.extensions?.['com.openai']?.auth;
    if (auth?.type !== 'oauth') fail('mcp.json', `${name}: the server needs a sign-in, so auth.type must be oauth`);
    if (auth?.client?.clientId || auth?.client?.clientSecret) fail('mcp.json', `${name}: no client id or secret with cimd or dcr`);
  }
}

if (problems.length) {
  console.error(problems.map((problem) => `✗ ${problem}`).join('\n'));
  process.exit(1);
}

if (checkOnly) {
  console.log('✓ ChatGPT package is consistent.');
  process.exit(0);
}

// --- ZIP ---------------------------------------------------------------------

function zip(entries) {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, compressed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const entries = [...files].sort().map((name) => ({ name, data: readFileSync(join(packageDir, name)) }));
const out = join(root, 'dist', `vidnavigator-chatgpt-${plugin.version}.zip`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, zip(entries));
console.log(`✓ ${out}`);
for (const entry of entries) console.log(`  ${entry.name} (${entry.data.length} bytes)`);
