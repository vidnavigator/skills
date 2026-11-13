#!/usr/bin/env node
// VidNavigator CLI for agent skills.
//
// Calls the tools of the hosted VidNavigator MCP server over plain HTTP, so a skill works in any
// agent that can run a command, with or without the MCP server configured. Same tool names and
// the same arguments as the MCP tools. No dependencies: Node.js 18 or later.
//
//   node vn.mjs <tool> key=value ... [--out FILE] [--transcript FILE] [--no-wait] [--timeout S]
//   node vn.mjs tools            list the tools
//   node vn.mjs help <tool>      a tool's arguments
//   node vn.mjs setup            check the API key, the connection and the credit balance
//
// This file is copied into each skill's scripts/ folder (a skill is installed as one folder).
// Edit skills/watch/scripts/vn.mjs, then run `node scripts/sync-cli.mjs`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const VERSION = '1.0.0';
const SERVER_URL = process.env.VIDNAVIGATOR_MCP_URL || 'https://api.vidnavigator.com/mcp/';
const KEY_FILE = join(homedir(), '.config', 'vidnavigator', 'api_key');
const KEY_PAGE = 'https://vidnavigator.com/studio/api';
const DOCS = 'https://docs.vidnavigator.com';

const EXIT_ERROR = 1; // the tool or the API answered an error
const EXIT_USAGE = 2; // the command line is wrong
const EXIT_NO_KEY = 3; // no API key found

class CliError extends Error {
  constructor(message, exitCode = EXIT_ERROR) {
    super(message);
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------
// API key
// ---------------------------------------------------------------------------

function findApiKey() {
  const fromEnv = (process.env.VIDNAVIGATOR_API_KEY || '').trim();
  if (fromEnv) return { key: fromEnv, source: 'the VIDNAVIGATOR_API_KEY environment variable' };
  if (existsSync(KEY_FILE)) {
    const fromFile = readFileSync(KEY_FILE, 'utf8').trim();
    if (fromFile) return { key: fromFile, source: KEY_FILE };
  }
  return null;
}

const NO_KEY_HELP = `No VidNavigator API key found.

1. Create a key: ${KEY_PAGE} (free trial, no credit card).
2. Give it to this CLI in one of two ways:
   - set the environment variable VIDNAVIGATOR_API_KEY, or
   - save the key, alone on one line, in the file ${KEY_FILE}

Do not paste the key into a command line: write the file with an editor.`;

// ---------------------------------------------------------------------------
// MCP over HTTP (JSON-RPC, one POST per call, no session)
// ---------------------------------------------------------------------------

let rpcId = 0;

async function rpc(method, params, apiKey) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': `vidnavigator-skills/${VERSION}`,
  };
  if (apiKey) headers['X-API-Key'] = apiKey;

  let response;
  try {
    response = await fetch(SERVER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params: params || {} }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? 'no answer after 180 seconds' : error?.cause?.message || error?.message;
    throw new CliError(`Cannot reach VidNavigator at ${SERVER_URL}: ${reason}`);
  }

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new CliError(`VidNavigator answered HTTP ${response.status} with a body that is not JSON: ${text.slice(0, 300)}`);
  }
  if (body.error) {
    const message = body.error.message || JSON.stringify(body.error);
    throw new CliError(/api key/i.test(message) ? `${message}\n\n${NO_KEY_HELP}` : message, /api key/i.test(message) ? EXIT_NO_KEY : EXIT_ERROR);
  }
  return body.result;
}

async function listTools() {
  const result = await rpc('tools/list');
  return result.tools || [];
}

// A tool answers one text block holding JSON.
async function callTool(name, args, apiKey) {
  const result = await rpc('tools/call', { name, arguments: args }, apiKey);
  const text = (result.content || []).map((item) => item.text || '').join('');
  try {
    return JSON.parse(text);
  } catch {
    return { status: 'success', text };
  }
}

// ---------------------------------------------------------------------------
// Arguments: key=value, typed from the tool's own schema
// ---------------------------------------------------------------------------

function readValueFile(path) {
  const full = resolve(path);
  if (!existsSync(full)) throw new CliError(`File not found: ${full}`, EXIT_USAGE);
  return readFileSync(full, 'utf8');
}

function coerce(name, raw, property) {
  const type = property?.type;
  const fromFile = raw.startsWith('@') && raw.length > 1;
  const value = fromFile ? readValueFile(raw.slice(1)) : raw;

  if (type === 'integer' || type === 'number') {
    const number = Number(value.trim());
    if (value.trim() === '' || Number.isNaN(number) || (type === 'integer' && !Number.isInteger(number))) {
      throw new CliError(`'${name}' must be ${type === 'integer' ? 'a whole number' : 'a number'}, got "${raw}".`, EXIT_USAGE);
    }
    return number;
  }
  if (type === 'boolean') {
    const word = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(word)) return true;
    if (['false', '0', 'no'].includes(word)) return false;
    throw new CliError(`'${name}' must be true or false, got "${raw}".`, EXIT_USAGE);
  }
  if (type === 'array' || type === 'object') {
    try {
      return JSON.parse(value);
    } catch {
      if (type === 'array' && !fromFile) return value.split(',').map((item) => item.trim()).filter(Boolean);
      throw new CliError(`'${name}' must be JSON (${type}). Write it to a file and pass ${name}=@file.json.`, EXIT_USAGE);
    }
  }
  return fromFile ? value.trim() : value;
}

function parseCommandLine(argv) {
  const options = { out: null, transcript: null, wait: true, timeout: 900, argsFile: null };
  const pairs = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new CliError(`${arg} needs a value.`, EXIT_USAGE);
      return argv[++i];
    };
    if (arg === '--out') options.out = next();
    else if (arg === '--transcript') options.transcript = next();
    else if (arg === '--args') options.argsFile = next();
    else if (arg === '--timeout') options.timeout = Number(next());
    else if (arg === '--no-wait') options.wait = false;
    else if (arg.startsWith('--')) throw new CliError(`Unknown option ${arg}.`, EXIT_USAGE);
    else pairs.push(arg);
  }
  if (!Number.isFinite(options.timeout) || options.timeout <= 0) throw new CliError('--timeout takes a number of seconds.', EXIT_USAGE);
  return { options, pairs };
}

function buildArguments(tool, pairs, argsFile) {
  const properties = tool.inputSchema?.properties || {};
  const args = {};
  if (argsFile) {
    try {
      Object.assign(args, JSON.parse(readValueFile(argsFile)));
    } catch (error) {
      if (error instanceof CliError) throw error;
      throw new CliError(`--args ${argsFile} is not valid JSON.`, EXIT_USAGE);
    }
  }
  for (const pair of pairs) {
    const at = pair.indexOf('=');
    if (at <= 0) {
      throw new CliError(`Arguments are written key=value, got "${pair}". Quote a value that holds spaces, & or ?.`, EXIT_USAGE);
    }
    const name = pair.slice(0, at);
    if (!(name in properties)) {
      throw new CliError(`'${tool.name}' has no argument '${name}'. It takes: ${Object.keys(properties).join(', ') || 'no argument'}.`, EXIT_USAGE);
    }
    args[name] = coerce(name, pair.slice(at + 1), properties[name]);
  }
  for (const name of tool.inputSchema?.required || []) {
    if (!(name in args)) throw new CliError(`'${tool.name}' needs '${name}'. Run: node vn.mjs help ${tool.name}`, EXIT_USAGE);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Background tasks and paginated results
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const isError = (result) => result && typeof result === 'object' && result.status === 'error';
const LIST_KEYS = ['results', 'videos'];

async function waitForTask(submitted, apiKey, timeoutSeconds) {
  const { task_id: taskId, task_type: taskType } = submitted;
  const paginated = taskType.startsWith('tiktok');
  const interval = (submitted.poll_interval_seconds || 3) * 1000;
  const deadline = Date.now() + timeoutSeconds * 1000;
  const baseArgs = { task_type: taskType, task_id: taskId, ...(paginated ? { limit: 500 } : {}) };

  process.stderr.write(`Task ${taskId} started, waiting`);
  let status;
  for (;;) {
    status = await callTool('get_task_status', baseArgs, apiKey);
    if (isError(status)) break;
    const state = status.data?.task_status;
    if (state !== 'processing') break;
    if (Date.now() > deadline) {
      process.stderr.write('\n');
      throw new CliError(
        `Task ${taskId} is still running after ${timeoutSeconds} s. Read it later with:\n` +
          `  node vn.mjs get_task_status task_type=${taskType} task_id=${taskId}`,
      );
    }
    process.stderr.write('.');
    await sleep(interval);
  }
  process.stderr.write('\n');
  if (isError(status) || !paginated) return status;

  // Following pages are appended to the first one.
  const data = status.data || {};
  const listKey = LIST_KEYS.find((key) => Array.isArray(data[key]));
  let cursor = data.pagination?.has_next ? data.pagination.next_cursor : null;
  while (listKey && cursor) {
    const page = await callTool('get_task_status', { ...baseArgs, cursor }, apiKey);
    if (isError(page)) break;
    data[listKey].push(...(page.data?.[listKey] || []));
    cursor = page.data?.pagination?.has_next ? page.data.pagination.next_cursor : null;
  }
  if (listKey) delete data.pagination;
  return status;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function clock(seconds, withHours) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return withHours ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const isSegmentList = (value) =>
  Array.isArray(value) && value.length > 0 && value.every((item) => item && typeof item === 'object' && typeof item.text === 'string');

// Every transcript in a result, with the details of its video when they sit beside it.
function findTranscripts(node, found = []) {
  if (Array.isArray(node)) {
    for (const item of node) findTranscripts(item, found);
  } else if (node && typeof node === 'object') {
    const transcript = node.transcript;
    if (isSegmentList(transcript) || (typeof transcript === 'string' && transcript.trim())) {
      found.push({ transcript, info: node.video_info || node.file_info || {} });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'transcript') findTranscripts(value, found);
    }
  }
  return found;
}

// Segments of a few seconds are joined into blocks of about 30 seconds: fewer lines, same timestamps.
function renderSegments(segments) {
  const last = segments[segments.length - 1];
  const withHours = Number(last.end ?? last.start ?? 0) >= 3600;
  const lines = [];
  let blockStart = null;
  let words = [];
  const flush = () => {
    if (words.length) lines.push(`[${clock(blockStart, withHours)}] ${words.join(' ')}`);
    words = [];
    blockStart = null;
  };
  for (const segment of segments) {
    const start = Number(segment.start) || 0;
    if (blockStart !== null && start - blockStart >= 30) flush();
    if (blockStart === null) blockStart = start;
    const text = segment.text.replace(/\s+/g, ' ').trim();
    if (text) words.push(text);
  }
  flush();
  return lines.join('\n');
}

function renderTranscripts(transcripts) {
  return transcripts
    .map(({ transcript, info }, index) => {
      const header = [];
      if (transcripts.length > 1) header.push(`# Video ${index + 1} of ${transcripts.length}`);
      if (info.title) header.push(`Title: ${info.title}`);
      if (info.channel) header.push(`Channel: ${info.channel}`);
      if (info.url) header.push(`URL: ${info.url}`);
      if (info.duration) header.push(`Duration: ${clock(info.duration, Number(info.duration) >= 3600)}`);
      if (info.published_date) header.push(`Published: ${info.published_date}`);
      if (info.views != null) header.push(`Views: ${info.views}`);
      const body = typeof transcript === 'string' ? transcript.trim() : renderSegments(transcript);
      return `${header.join('\n')}\n\n${body}`.trim();
    })
    .join('\n\n\n');
}

function writeFile(path, content) {
  const full = resolve(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}

// A short description of a result that went to a file, so the agent knows what it holds.
function describe(result) {
  const data = result?.data && typeof result.data === 'object' ? result.data : result;
  const lines = [];
  for (const [key, value] of Object.entries(data || {})) {
    if (Array.isArray(value)) lines.push(`  ${key}: ${value.length} item${value.length === 1 ? '' : 's'}`);
    else if (value && typeof value === 'object') lines.push(`  ${key}: {${Object.keys(value).slice(0, 8).join(', ')}}`);
    else if (value != null && String(value).length <= 120) lines.push(`  ${key}: ${value}`);
  }
  return lines.join('\n');
}

function print(result, options) {
  const transcripts = options.transcript ? findTranscripts(result) : [];
  if (options.transcript) {
    if (transcripts.length) {
      const text = renderTranscripts(transcripts);
      const path = writeFile(options.transcript, `${text}\n`);
      const words = text.split(/\s+/).length;
      console.log(`Transcript written to ${path} (${transcripts.length > 1 ? `${transcripts.length} videos, ` : ''}about ${words} words).`);
      const info = transcripts[0].info;
      if (Object.keys(info).length) {
        const { title, channel, duration, views, likes, published_date: published, url } = info;
        console.log(JSON.stringify({ title, channel, duration, views, likes, published_date: published, url }, null, 2));
      }
    } else {
      console.log('This result holds no transcript: nothing written to the --transcript file.');
    }
  }
  if (options.out) {
    const path = writeFile(options.out, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Result written to ${path}`);
    console.log(describe(result));
  }
  if (!options.out && !(options.transcript && transcripts.length)) {
    console.log(JSON.stringify(withoutTaskBookkeeping(result), null, 2));
  }
}

// What a finished task says about itself (the request echoed back, dates, webhook state) is of no
// use on screen. --out keeps it all.
const TASK_BOOKKEEPING = ['request', 'webhook', 'check_status_url', 'job_type', 'created_at', 'started_at', 'completed_at', 'expires_at', 'download_url'];

function withoutTaskBookkeeping(result) {
  if (!result?.data || typeof result.data !== 'object' || !('task_status' in result.data)) return result;
  const data = Object.fromEntries(Object.entries(result.data).filter(([key]) => !TASK_BOOKKEEPING.includes(key)));
  return { ...result, data };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const firstSentence = (text) => (text || '').split(/(?<=[.!?])\s/)[0].trim();

function usage(tools) {
  const lines = [
    `VidNavigator CLI ${VERSION}: the tools of the VidNavigator MCP server, from a command line.`,
    '',
    'Usage:',
    '  node vn.mjs <tool> key=value ...   call a tool; a background task is waited for',
    '  node vn.mjs help <tool>            the arguments of a tool',
    '  node vn.mjs tools                  the list of tools',
    '  node vn.mjs setup                  check the API key, the connection and the credits',
    '',
    'Options:',
    '  --out FILE          write the full JSON result to FILE and print a short description',
    '  --transcript FILE   write the transcript to FILE as text with timestamps, [m:ss] at each block',
    '  --args FILE         read the arguments from a JSON file (key=value pairs then override it)',
    '  --no-wait           return the task_id of a background task without waiting',
    '  --timeout SECONDS   how long to wait for a background task (default 900)',
    '',
    'Values: key=value. Quote a value that holds spaces, & or ?: video_url="https://youtu.be/x?t=10".',
    'Objects and lists are read from a file: schema=@schema.json.',
    '',
    `API key: ${KEY_PAGE}, then VIDNAVIGATOR_API_KEY or the file ${KEY_FILE}`,
  ];
  if (tools?.length) {
    lines.push('', 'Tools:');
    for (const tool of tools) lines.push(`  ${tool.name.padEnd(26)} ${firstSentence(tool.description).slice(0, 110)}`);
  }
  return lines.join('\n');
}

function toolHelp(tool) {
  const properties = tool.inputSchema?.properties || {};
  const required = new Set(tool.inputSchema?.required || []);
  const lines = [tool.name, '', tool.description || '', '', 'Arguments:'];
  if (!Object.keys(properties).length) lines.push('  none');
  for (const [name, property] of Object.entries(properties)) {
    const facts = [property.type || 'any'];
    if (required.has(name)) facts.push('required');
    if (property.enum) facts.push(`one of ${property.enum.join(' | ')}`);
    if (property.default !== undefined) facts.push(`default ${JSON.stringify(property.default)}`);
    lines.push(`  ${name} (${facts.join(', ')})`);
    if (property.description) lines.push(`      ${property.description}`);
  }
  return lines.join('\n');
}

async function setup() {
  console.log(`VidNavigator CLI ${VERSION}, Node.js ${process.versions.node}`);
  console.log(`Server: ${SERVER_URL}`);
  const tools = await listTools();
  console.log(`Connection: OK, ${tools.length} tools`);
  const found = findApiKey();
  if (!found) {
    console.log(`\n${NO_KEY_HELP}`);
    process.exitCode = EXIT_NO_KEY;
    return;
  }
  console.log(`API key: found in ${found.source}`);
  const usageResult = await callTool('get_usage', {}, found.key);
  if (isError(usageResult)) {
    console.log(`The key was refused: ${usageResult.message || usageResult.error}`);
    console.log(`Create or check a key at ${KEY_PAGE}`);
    process.exitCode = EXIT_ERROR;
    return;
  }
  const credits = usageResult.data?.credits || usageResult.credits;
  if (credits && typeof credits === 'object') console.log(`Credits: ${JSON.stringify(credits)}`);
  console.log('Ready.');
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 18) {
    throw new CliError(`Node.js 18 or later is needed (this is ${process.versions.node}).`, EXIT_USAGE);
  }
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    let tools = [];
    try {
      tools = await listTools();
    } catch {
      // Offline: the usage is still worth printing.
    }
    console.log(usage(tools));
    return;
  }
  if (command === '--version' || command === 'version') return console.log(VERSION);
  if (command === 'setup') return setup();

  const tools = await listTools();
  if (command === 'tools') return console.log(usage(tools));

  const toolName = command === 'help' ? rest[0] : command;
  const tool = tools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    throw new CliError(`Unknown tool '${toolName ?? ''}'. Tools: ${tools.map((candidate) => candidate.name).join(', ')}`, EXIT_USAGE);
  }
  if (command === 'help') return console.log(toolHelp(tool));

  const { options, pairs } = parseCommandLine(rest);
  const args = buildArguments(tool, pairs, options.argsFile);
  const found = findApiKey();
  if (!found) throw new CliError(NO_KEY_HELP, EXIT_NO_KEY);

  let result = await callTool(tool.name, args, found.key);
  if (options.wait && !isError(result) && result.status === 'accepted' && result.task_id && result.task_type) {
    result = await waitForTask(result, found.key, options.timeout);
  }

  const failedTask = result?.data?.task_status === 'failed';
  if (isError(result) || failedTask) {
    console.log(JSON.stringify(result, null, 2));
    const status = Number(result.status_code);
    if (status === 401) console.error(`\nThe API key was refused. Check it at ${KEY_PAGE}`);
    if (status === 402) console.error('\nNot enough credits for this call: https://vidnavigator.com/pricing');
    process.exitCode = EXIT_ERROR;
    return;
  }
  print(result, options);
}

main().catch((error) => {
  console.error(error instanceof CliError ? error.message : `Unexpected error: ${error?.stack || error}`);
  if (!(error instanceof CliError)) console.error(`Documentation: ${DOCS}`);
  process.exitCode = error instanceof CliError ? error.exitCode : EXIT_ERROR;
});
