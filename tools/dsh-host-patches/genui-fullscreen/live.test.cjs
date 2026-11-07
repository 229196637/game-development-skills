'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { MARKER, sha } = require('./patch.cjs');
(async () => {
  const origin = process.env.DSH_GUI_URL || 'http://127.0.0.1:61638/';
  const r = await fetch(new URL('plugins/events', origin), { signal: AbortSignal.timeout(8000) });
  assert.equal(r.status, 200);
  const reader = r.body.getReader();
  let text = '', data;
  while (!(data = text.match(/^data:([^\n]*)\n/m)?.[1])) {
    const next = await reader.read();
    if (next.done) throw Error('SSE closed before graph');
    text += new TextDecoder().decode(next.value);
  }
  await reader.cancel();
  const graph = JSON.parse(data).graph;
  const row = graph.entries.find(entry => entry.id === '@changfenhuang/dsh-genui');
  assert.ok(row, 'GenUI active');
  const response = await fetch(new URL(row.url, origin), { signal: AbortSignal.timeout(8000) });
  assert.equal(response.status, 200);
  const served = Buffer.from(await response.arrayBuffer());
  const installed = fs.readFileSync(process.env.DSH_GENUI_CLIENT || 'C:/Users/22919/.dsh/profiles/desktop/node_modules/@changfenhuang/dsh-genui/lib/client.js');
  // Host may append sourceURL/sourceMappingURL; compare the actual module body.
  const body = installed.toString('utf8').replace(/\n?\/\/[#@] source(?:Mapping)?URL=.*(?:\r?\n|$)/g, '').trimEnd();
  assert.ok(served.toString('utf8').startsWith(body), 'current GUI serves installed module bytes');
  assert.ok(served.includes(Buffer.from(MARKER)), 'current GUI serves fullscreen patch');
  assert.ok(served.toString('utf8').includes("open: '展开查看'"), 'current GUI serves card-view button label');
  assert.ok(served.toString('utf8').includes('width: min(1360px, calc(100vw - 64px))'), 'current GUI serves bounded card dimensions');
  assert.notEqual(row.rev, '3c1a3069479d', 'published revision changed from pre-patch');
  assert.notEqual(row.rev, 'ba3ffb770e9a', 'published revision changed from fullscreen version');
  console.log(JSON.stringify({ origin, genui: row, hmr: graph.entries.some(entry => entry.id === '@deepseek-ai/dsh-client-hmr'), status: response.status, servedBytes: served.length, installedSha256: sha(installed), cardViewPatchServed: true, settingsReadOrChanged: false }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
