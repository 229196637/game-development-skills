import path from 'node:path';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: false });
const MAX_REFERENCES = 40;
const MAX_REPORT_BYTES = 256 * 1024;
const message = error => String(error?.message || error);
const kindFor = value => {
  const ext = path.extname(value).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'].includes(ext)) return 'image';
  if (['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.ogv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'].includes(ext)) return 'audio';
  return ['.md', '.txt', '.pdf', '.log', '.json', '.csv', '.html'].includes(ext) ? 'report' : 'file';
};

/** Only standard Markdown destinations or a complete single local path; never HTML or prose scraping. */
export function evidenceReferences(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const references = [];
  const visit = tokens => {
    for (const [index, token] of (tokens || []).entries()) {
      if (token.type === 'image') references.push({ href: token.attrGet('src'), label: token.content });
      if (token.type === 'link_open') {
        let label = '';
        for (let next = index + 1; next < tokens.length && tokens[next].type !== 'link_close'; next++) label += tokens[next].content || '';
        references.push({ href: token.attrGet('href'), label });
      }
      // Image children contain alt text, not additional destinations.
      if (token.type !== 'image') visit(token.children);
    }
  };
  visit(markdown.parse(text, {}));
  if (references.length) return references;
  let single = text.trim();
  if ((single.startsWith('"') && single.endsWith('"')) || (single.startsWith('`') && single.endsWith('`'))) single = single.slice(1, -1);
  if (!/[\r\n\u0000-\u001f<>]/u.test(single) && !/[\[\]]/u.test(single) && /\.[a-z0-9]{1,12}$/iu.test(single) && !/^(?:https?:|data:|javascript:|file:|\/\/)/i.test(single)) {
    references.push({ href: single, label: '' , literal: true });
  }
  return references;
}

function localDestination(reference) {
  let value = reference.href;
  if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error('无效证据路径。');
  // A drive letter is a local path, not a URI scheme. No network/UNC paths.
  if (/^(?:[a-z][a-z0-9+.-]*:)/i.test(value) && !/^[a-z]:[\\/]/i.test(value) || /^(?:\/\/|\\\\)/.test(value)) throw new Error('仅支持工作目录内的本地文件，不加载网络或 URI。');
  if (!reference.literal) {
    value = value.split(/[?#]/, 1)[0];
    try { value = decodeURIComponent(value); } catch { throw new Error('证据链接编码无效。'); }
  }
  if (!value || /[\u0000-\u001f\u007f]/u.test(value) || /^(?:\/\/|\\\\)/.test(value)) throw new Error('无效证据路径。');
  return value;
}

/** Bounded, read-only evidence projection over the existing dashboard snapshot and scoped fs. */
export async function collectEvidence(target, taskId, signal) {
  const { fs } = target;
  const snapshot = await target.dashboard(target.root, signal);
  const task = snapshot.tasks?.find(item => item.id === taskId);
  if (!task) throw new Error('所选工单不存在，请刷新任务。');
  const base = await fs.resolve(target.cwd, { signal });
  const items = [];
  const issues = [];
  let partial = false;
  const issue = (sourceFile, sourceField, reason) => issues.push({ sourceFile, sourceField, reason });
  const check = async (value, cwd) => {
    const resolved = await fs.resolve(value, { cwd, signal });
    if (!fs.contains(base, resolved)) throw new Error('证据文件超出当前工作目录。');
    const info = await fs.stat(resolved, signal);
    if (!info || info.type !== 'file') throw new Error('证据文件不存在或不是普通文件。');
    // stat/resolve are metadata operations; this bounded read also enforces the composed fs read policy.
    await fs.readByteRange(resolved, { offset: 0, length: 1 }, signal);
    return { resolved, info, actual: fs.processPath(resolved) };
  };
  let sourceFile;
  try {
    const checked = await check(task.file, target.root);
    sourceFile = checked.actual;
  } catch (error) {
    signal?.throwIfAborted();
    issue(String(task.file || ''), 'file', message(error));
    return { root: target.root, taskId, items, issues, partial: false };
  }
  const reports = [];
  const add = async (reference, context) => {
    if (items.length >= MAX_REFERENCES) { partial = true; return; }
    signal?.throwIfAborted();
    let actual = String(reference.href || '');
    let valid;
    let reason;
    try {
      const value = localDestination(reference);
      const resolved = await fs.resolve(value, { cwd: context.cwd, signal });
      actual = fs.processPath(resolved);
      valid = await check(value, context.cwd);
      actual = valid.actual;
    } catch (error) { signal?.throwIfAborted(); reason = message(error); }
    const id = createHash('sha256').update(JSON.stringify([taskId, context.sourceFile, context.sourceField, context.record, reference.href, actual])).digest('hex');
    const item = { id, kind: kindFor(actual), label: reference.label || path.basename(actual) || actual, path: actual, sourceFile: context.sourceFile, sourceField: context.sourceField, exists: Boolean(valid), ...(reason ? { reason } : {}), ...(valid?.info.size !== undefined ? { size: valid.info.size } : {}) };
    if (items.some(existing => existing.id === id)) return;
    items.push(item);
    if (reason) issue(item.sourceFile, item.sourceField, reason);
    if (valid && context.direct && path.extname(actual).toLowerCase() === '.md') reports.push({ item, ...valid, record: context.record });
  };
  for (const [index, record] of (task.latest_tests || []).entries()) {
    if (typeof record.report !== 'string' || !record.report.trim()) continue;
    // Test reports deliberately retain planning_tool's process-cwd/absolute Path semantics.
    await add({ href: record.report, literal: true }, { cwd: target.cwd, sourceFile, sourceField: `latest_tests[${index}].report`, record, direct: true });
  }
  for (const [index, record] of (task.latest_acceptance || []).entries()) {
    for (const reference of evidenceReferences(record.evidence)) await add(reference, { cwd: path.dirname(sourceFile), sourceFile, sourceField: `latest_acceptance[${index}].evidence`, record, direct: true });
  }
  const seenReports = new Set();
  for (const report of reports) {
    if (seenReports.has(report.actual)) continue;
    seenReports.add(report.actual);
    if (items.length >= MAX_REFERENCES) { partial = true; break; }
    try {
      if (report.info.size === undefined || report.info.size > MAX_REPORT_BYTES) throw new Error('报告超过 256 KiB 或大小未知，未扫描内部链接。');
      const bytes = await fs.readBytes(report.resolved, signal, MAX_REPORT_BYTES);
      const references = evidenceReferences(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      for (const reference of references) await add(reference, { cwd: path.dirname(report.actual), sourceFile: report.actual, sourceField: 'markdown', record: [report.item.id, report.record], direct: false });
    } catch (error) { signal?.throwIfAborted(); partial = true; issue(report.actual, 'markdown', message(error)); }
  }
  return { root: target.root, taskId, items, issues, partial };
}
