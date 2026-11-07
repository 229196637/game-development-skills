import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { apply, inject } from '../index.js';

/** Executes the real Host apply/handler, with a controlled Connection decision.
 * Tests delegation and ordering, not Connection's own credential algorithms.
 * All rule writes are confined to a fresh temporary profile, never the user's.
 */
test('Host rule route delegates trust/auth checks before any file or body access', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dsh-changes-filter-test-'));
  const originalDirectory = process.env.DSH_PROFILE_DIR;
  const rulesPath = path.join(directory, 'changes-filter.json');
  process.env.DSH_PROFILE_DIR = directory;
  let route;
  let rejection;
  let authChecks = 0;
  let disposed = false;
  const warnings = [];
  const effects = [];
  try {
    assert.deepEqual(inject, ['webServer', 'connection']);
    apply({
      logger: { warn(message) { warnings.push(message); }, info() {} },
      connection: { requestRejection(request) {
        assert.ok(request.headers);
        authChecks += 1;
        return rejection;
      } },
      webServer: { register(value) {
        route = value;
        return () => { disposed = true; };
      } },
      effect(setup) { effects.push(setup()); },
    });
    assert.equal(route.kind, 'exact');
    assert.equal(route.path, '/dsh-changes-filter/rules.json');

    async function request(method, body, denied = undefined) {
      rejection = denied;
      const incoming = denied === undefined
        ? Readable.from(body === undefined ? [] : [Buffer.from(body)])
        : { on() { throw new Error('denied request body must not be consumed'); } };
      incoming.method = method;
      incoming.headers = { host: '127.0.0.1', origin: 'http://127.0.0.1' };
      const response = {
        headersSent: false,
        writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
        end(value) { this.body = value; this.ended = true; },
      };
      const previousChecks = authChecks;
      await route.handler(incoming, response);
      assert.equal(authChecks, previousChecks + 1, 'every request must pass through Connection');
      assert.equal(response.ended, true);
      return response;
    }

    for (const status of [401, 403]) {
      for (const method of ['GET', 'HEAD', 'PUT']) {
        await t.test(`${method} rejects ${status} before reading rules or consuming a body`, async () => {
          // Entering readRules would parse this sentinel and emit a warning.
          // A denied request must not even enter that rule-loading path.
          const sentinel = '{"dirs":["private-folder"],"exts":[".secret"] INVALID}\n';
          await writeFile(rulesPath, sentinel, 'utf8');
          const previousWarnings = warnings.length;
          const result = await request(method, '{"dirs":["overwritten"]}', status);
          assert.equal(warnings.length, previousWarnings, 'denied request must not load rules');
          assert.equal(result.status, status);
          assert.equal(result.body.includes('private-folder'), false);
          assert.equal(result.body.includes('overwritten'), false);
          assert.equal(await readFile(rulesPath, 'utf8'), sentinel);
        });
      }
    }

    await t.test('missing rules migrate defaults without writing; corrupt rules fail visibly without overwriting', async () => {
      const corrupt = await readFile(rulesPath, 'utf8');
      const failed = await request('GET');
      assert.equal(failed.status, 500);
      assert.equal(await readFile(rulesPath, 'utf8'), corrupt);
      await rm(rulesPath);
      const missing = await request('GET');
      assert.equal(missing.status, 200);
      assert.deepEqual(JSON.parse(missing.body), { dirs: [], exts: [], noiseDirs: ['.agent-tmp'] });
      await assert.rejects(readFile(rulesPath), { code: 'ENOENT' });
    });

    await t.test('authenticated PUT normalizes and persists; GET returns the same rules', async () => {
      const result = await request('PUT', JSON.stringify({ dirs: ['./Docs/', 'docs'], exts: ['META'] }));
      assert.equal(result.status, 200);
      const expected = { dirs: ['docs'], exts: ['.meta'], noiseDirs: ['.agent-tmp'] };
      assert.deepEqual(JSON.parse(result.body), expected);
      assert.deepEqual(JSON.parse(await readFile(rulesPath, 'utf8')), expected);
      const read = await request('GET');
      assert.equal(read.status, 200);
      assert.deepEqual(JSON.parse(read.body), expected);
      assert.equal(read.headers['cache-control'], 'no-store');
    });

    await t.test('noise directory configuration roundtrips normalized names and an explicit disabled list', async () => {
      for (const [noiseDirs, expectedNames] of [
        [[' Scratch ', 'SCRATCH', '.agent-tmp', 'nested/path', 'nested\\path', '..', 'bad:name'], ['.agent-tmp', 'scratch']],
        [[], []],
      ]) {
        const expected = { dirs: ['docs'], exts: ['.meta'], noiseDirs: expectedNames };
        const saved = await request('PUT', JSON.stringify({ dirs: ['Docs'], exts: ['META'], noiseDirs }));
        assert.equal(saved.status, 200);
        assert.deepEqual(JSON.parse(saved.body), expected);
        assert.deepEqual(JSON.parse(await readFile(rulesPath, 'utf8')), expected);
        const loaded = await request('GET');
        assert.equal(loaded.status, 200);
        assert.deepEqual(JSON.parse(loaded.body), expected);
      }
    });

    await t.test('invalid authenticated JSON cannot overwrite saved rules', async () => {
      const before = await readFile(rulesPath, 'utf8');
      const result = await request('PUT', '{not-json');
      assert.equal(result.status, 400);
      assert.equal(await readFile(rulesPath, 'utf8'), before);
    });

    await t.test('authenticated unsupported methods return 405; unauthenticated ones are rejected first', async () => {
      assert.equal((await request('DELETE')).status, 405);
      assert.equal((await request('DELETE', undefined, 401)).status, 401);
    });

    await t.test('route lifetime is registered with the calling context', () => {
      assert.equal(effects.length, 1);
      assert.equal(typeof effects[0], 'function');
      effects[0]();
      assert.equal(disposed, true);
    });
  } finally {
    for (const dispose of effects) dispose();
    if (originalDirectory === undefined) delete process.env.DSH_PROFILE_DIR;
    else process.env.DSH_PROFILE_DIR = originalDirectory;
    // Only remove the exact fresh directory created by this test.
    assert.ok(path.isAbsolute(directory));
    assert.equal(path.dirname(directory), tmpdir());
    assert.ok(path.basename(directory).startsWith('dsh-changes-filter-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});
