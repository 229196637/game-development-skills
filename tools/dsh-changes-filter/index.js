/**
 * Host half of dsh-changes-filter.
 *
 * Owns the durable rule store and exposes it to the browser half over one
 * same-origin JSON route. Nothing here touches workspace snapshots: the Client
 * half still reads `api/changes.summary` for the file list, this route only
 * answers "which folders and extensions are hidden by default".
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import { normalizeRules } from './lib/rules.js';

/** The raw Web route must use Connection's trust and browser-auth checks. */
export const inject = ['webServer', 'connection'];

const ROUTE = '/dsh-changes-filter/rules.json';
const MAX_BODY_BYTES = 16 * 1024;
const EMPTY_RULES = { dirs: [], exts: [] };

/** The profile directory keeps rules across web ports; the port changes per run. */
function rulesFile() {
  const profileDir = process.env.DSH_PROFILE_DIR
    ?? path.join(homedir(), '.dsh', 'profiles', process.env.DSH_PROFILE ?? 'desktop');
  return path.join(profileDir, 'changes-filter.json');
}

async function readRules(logger) {
  try {
    const text = await readFile(rulesFile(), 'utf8');
    return normalizeRules(JSON.parse(text));
  } catch (error) {
    if (error?.code !== 'ENOENT') logger?.warn?.(`dsh-changes-filter: unreadable rules: ${error?.message ?? error}`);
    return EMPTY_RULES;
  }
}

async function writeRules(rules, logger) {
  const file = rulesFile();
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(rules, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
  logger?.info?.(`dsh-changes-filter: saved ${rules.dirs.length} folder rule(s) and ${rules.exts.length} extension rule(s)`);
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('body too large'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

export function apply(ctx) {
  const logger = ctx.logger;
  const dispose = ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    async handler(request, response) {
      try {
        // This route is outside /api, so it does not inherit its auth guard.
        // Reject before reading either the rule file or the request body.
        const rejection = ctx.connection.requestRejection(request);
        if (rejection !== undefined) {
          sendJson(response, rejection, { error: rejection === 401 ? 'unauthorized' : 'forbidden' });
          return;
        }
        if (request.method === 'GET' || request.method === 'HEAD') {
          sendJson(response, 200, await readRules(logger));
          return;
        }
        if (request.method === 'PUT') {
          let parsed;
          try {
            parsed = JSON.parse(await readBody(request));
          } catch (error) {
            sendJson(response, error?.status ?? 400, { error: error?.status === 413 ? 'body too large' : 'invalid json' });
            return;
          }
          const rules = normalizeRules(parsed);
          await writeRules(rules, logger);
          sendJson(response, 200, rules);
          return;
        }
        response.writeHead(405, { allow: 'GET, HEAD, PUT' });
        response.end();
      } catch (error) {
        logger?.warn?.(`dsh-changes-filter: request failed: ${error?.message ?? error}`);
        if (!response.headersSent) sendJson(response, 500, { error: 'internal error' });
        else response.end();
      }
    },
  });
  ctx.effect(() => dispose, 'dsh-changes-filter: rules route');
}
