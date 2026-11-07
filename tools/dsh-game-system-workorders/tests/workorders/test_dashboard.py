"""Isolated regression tests. Run: python -B -m unittest discover -s tests/workorders -v.
WORKORDER_SKILLS_ROOT overrides the parent directory containing the three skills.
No production projects or installed skill files are written.
"""
import importlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SKILLS = Path(os.environ.get('WORKORDER_SKILLS_ROOT', r'C:\Users\22919\.codex\skills'))
PLANNING = SKILLS / 'game-system-development-planning' / 'scripts'
EXECUTION = SKILLS / 'game-system-development-execution' / 'scripts'
sys.path.insert(0, str(PLANNING))
sys.path.insert(0, str(EXECUTION))
store = importlib.import_module('task_store')
execution = importlib.import_module('execution_tool')
STAMP = '2026-11-07 10:00:00 +08:00'
DETAIL_KEYS = {'id', 'file', 'status', 'claim', 'document', 'references', 'items', 'required_tests', 'acceptance'}


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='workorders-regression-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'docs' / '规划' / '隔离任务'
        self.docs = self.base / 'docs' / '文档' / '模块'
        self.root.mkdir(parents=True)
        self.docs.mkdir(parents=True)
        (self.docs / '目录架构.md').write_text('# 目录架构\n', encoding='utf-8')
        (self.docs / 'README.md').write_text('[目录](目录架构.md)\n', encoding='utf-8')
        self.paths = {}
        self.order([])

    def order(self, ids):
        rows = ['| 顺序 | 任务 ID | 工单 |', '| --- | --- | --- |']
        rows += [f'| {n} | {key} | [{key}](模块/职责/{key}.md) |' for n, key in enumerate(ids, 1)]
        (self.root / 'README.md').write_text('# 隔离任务\n<!-- planning-todo:begin -->\n' + '\n'.join(rows) + '\n<!-- planning-todo:end -->\n', encoding='utf-8')

    def task(self, key, status='todo', depends=(), marks=(' ',), claim=None, updated=STAMP):
        document = self.docs / '职责' / (key + '.md')
        document.parent.mkdir(exist_ok=True)
        document.write_text('# ' + key + '\n', encoding='utf-8')
        path = self.root / '模块' / '职责' / (key + '.md')
        index = '\n'.join(f'- [{p.name}]({store.reference(path, p)})' for p in [document, self.docs / 'README.md', self.docs / '目录架构.md'])
        body = store.work_order(key, '隔离目标', '具体改动', ['工作项' + str(i) for i in range(len(marks))], index, '| 验收 ID | 通过条件 |\n| --- | --- |\n| A1 | 可观察条件 |')
        body = store.replace_section(body, '任务内容', '\n'.join(f'- [{mark}] 工作项{i}' for i, mark in enumerate(marks)))
        meta = dict(zip(store.KEYS, [key, key, store.reference(path, document), status, list(depends), ['T1'], ['A1'], updated]))
        task = {'path': path, 'meta': meta, 'body': body}
        if claim:
            execution.set_owner(task, {'owner': claim, 'time': STAMP})
        store.save(task)
        # save deliberately stamps writes; fixture timestamp is explicit and reproducible.
        text = path.read_text(encoding='utf-8').replace(json.dumps(meta['updated']), json.dumps(updated))
        path.write_text(text, encoding='utf-8')
        self.paths[key] = path
        self.order(list(self.paths))
        return store.read(path)

    def evidence(self, key, result='passed', time=STAMP, report=None, acceptance='passed'):
        task = store.read(self.paths[key])
        if report is None:
            report = self.base / 'reports' / (key + '.md')
            report.parent.mkdir(exist_ok=True)
            report.write_text('# 真实隔离报告 fixture\n', encoding='utf-8')
        store.append_row(task, '测试过程', [time, 'T1', 'python -B test.py', 'exit 0', 'exit 0', result, str(report)])
        store.append_row(task, '验收情况', [time, 'A1', 'observed', acceptance, 'fixture evidence'])
        store.save(task)
        return report

    def snapshot(self):
        return {str(p.relative_to(self.base)): (p.read_bytes(), p.stat().st_mtime_ns) for p in self.base.rglob('*') if p.is_file()}

    def cli(self, script, *args):
        process = subprocess.run([sys.executable, '-B', str(script), *map(str, args)], cwd=self.base, capture_output=True, encoding='utf-8', env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONIOENCODING': 'utf-8'})
        return process.returncode, json.loads(process.stdout)

    def test_empty_snapshot_is_read_only_and_has_exact_schema(self):
        before = self.snapshot()
        value = store.dashboard(self.root)
        self.assertEqual(set(value), {'schemaVersion', 'root', 'readme', 'updated', 'counts', 'progress', 'ready', 'next', 'tasks', 'consistency'})
        self.assertEqual(value['schemaVersion'], 1)
        self.assertIsNone(value['updated'])
        self.assertIsNone(value['next'])
        self.assertEqual(value['progress'], dict(completed=0, total=0, percent=0, itemsChecked=0, itemsTotal=0))
        self.assertEqual(value['consistency'], {'stable': True})
        self.assertEqual(before, self.snapshot())
        self.assertFalse((self.root / '.execution.lock').exists())

    def test_order_counts_progress_owner_and_dependencies(self):
        self.task('Z', 'completed', marks=('X', 'x'))
        self.evidence('Z')
        self.task('B', depends=('Z',), marks=('X', ' '))
        self.task('A', depends=('B',))
        self.task('D', 'doing', claim='worker-one')
        self.task('C', 'blocked')
        value = store.dashboard(self.root)
        self.assertEqual([t['id'] for t in value['tasks']], ['Z', 'B', 'A', 'D', 'C'])
        self.assertEqual(value['counts'], dict(todo=2, doing=1, blocked=1, completed=1, total=5))
        self.assertEqual(value['progress'], dict(completed=1, total=5, percent=20.0, itemsChecked=3, itemsTotal=7))
        self.assertEqual(value['ready'], ['B'])
        self.assertEqual(value['next']['id'], 'B')
        self.assertEqual(value['tasks'][2]['blocked_by'], ['B'])
        self.assertEqual(value['tasks'][3]['claim']['owner'], 'worker-one')
        self.assertTrue(all(Path(t['document']).is_absolute() for t in value['tasks']))

    def test_todo_with_owner_is_not_ready(self):
        self.task('A', claim='held')
        self.assertEqual(store.dashboard(self.root)['ready'], [])

    def test_latest_evidence_uses_append_not_timestamp_and_retains_history(self):
        self.task('A')
        self.evidence('A', time='2026-11-07 23:00:00 +08:00')
        missing = self.base / 'missing-report.md'
        self.evidence('A', 'not-run', time='2020-01-01 00:00:00 +00:00', report=missing, acceptance='failed')
        task = store.dashboard(self.root)['tasks'][0]
        self.assertEqual(len(task['tests']), 2)
        self.assertEqual(len(task['acceptance_records']), 2)
        self.assertEqual(task['latest_tests'][0]['result'], 'not-run')
        self.assertFalse(task['latest_tests'][0]['reportExists'])
        self.assertEqual(task['latest_acceptance'][0]['result'], 'failed')

    def test_latest_rows_order_is_last_occurrence_position(self):
        rows = [['t', 'T1'], ['t', 'T2'], ['old', 'T1']]
        self.assertEqual(store.latest_rows(rows), [rows[1], rows[2]])

    def test_updated_compares_timezone_and_ignores_impossible_dates(self):
        self.task('A', updated='2026-11-07 10:00:00 +08:00')
        self.task('B', updated='2026-11-07 03:00:00 +00:00')
        self.task('C', updated='2026-02-30 23:00:00 +00:00')
        self.assertEqual(store.dashboard(self.root)['updated'], '2026-11-07 03:00:00 +00:00')

    def test_all_invalid_calendar_updates_yield_null(self):
        self.task('A', updated='2026-02-30 23:00:00 +00:00')
        self.assertIsNone(store.dashboard(self.root)['updated'])

    def test_existing_execution_lock_is_preserved_and_has_priority(self):
        lock = self.root / '.execution.lock'
        lock.write_bytes(b'stale-lock-never-steal')
        with patch.object(store, 'dashboard_inputs', side_effect=range(6)) as signatures:
            value = store.dashboard(self.root)
        self.assertEqual(signatures.call_count, 6)
        self.assertEqual(value['consistency'], {'stable': False, 'reason': 'execution-lock'})
        self.assertEqual(lock.read_bytes(), b'stale-lock-never-steal')

    def test_transient_input_change_retries_then_returns_stable(self):
        with patch.object(store, 'dashboard_inputs', side_effect=[1, 2, 3, 3]) as signatures:
            value = store.dashboard(self.root)
        self.assertEqual(signatures.call_count, 4)
        self.assertEqual(value['consistency'], {'stable': True})

    def test_continuous_input_change_is_bounded(self):
        with patch.object(store, 'dashboard_inputs', side_effect=range(6)) as signatures:
            value = store.dashboard(self.root)
        self.assertEqual(signatures.call_count, 6)
        self.assertEqual(value['consistency'], {'stable': False, 'reason': 'inputs-changed'})
        with self.assertRaisesRegex(ValueError, '重试次数'):
            store.dashboard(self.root, attempts=0)

    def test_last_parse_failure_does_not_return_earlier_success(self):
        real = store.todo_order
        with patch.object(store, 'dashboard_inputs', side_effect=range(6)), patch.object(store, 'todo_order', side_effect=[real(self.root), real(self.root), ValueError('last read corrupted')]):
            with self.assertRaisesRegex(ValueError, 'last read corrupted'):
                store.dashboard(self.root)

    def test_signatures_cover_added_markdown_external_index_and_report(self):
        self.task('A')
        report = self.evidence('A')
        initial = store.dashboard_inputs(self.root)
        (self.root / 'README-extra.md').write_text('new', encoding='utf-8')
        self.assertNotEqual(initial, store.dashboard_inputs(self.root))
        initial = store.dashboard_inputs(self.root)
        (self.docs / 'README.md').write_text('[目录](目录架构.md) extra', encoding='utf-8')
        self.assertNotEqual(initial, store.dashboard_inputs(self.root))
        initial = store.dashboard_inputs(self.root)
        report.unlink()
        self.assertNotEqual(initial, store.dashboard_inputs(self.root))

    def test_completed_gate_rejects_unchecked_items(self):
        self.task('A', 'completed')
        self.evidence('A')
        with self.assertRaisesRegex(ValueError, '尚未全部勾选'):
            store.dashboard(self.root)

    def test_completed_gate_rejects_latest_failed_or_not_run_results(self):
        for result, acceptance, message in [('failed', 'passed', '必需测试'), ('not-run', 'passed', '必需测试'), ('passed', 'failed', '验收最近')]:
            with self.subTest(result=result, acceptance=acceptance):
                self.task('A', 'completed', marks=('x',))
                self.evidence('A', result, acceptance=acceptance)
                with self.assertRaisesRegex(ValueError, message):
                    store.dashboard(self.root)

    def test_completed_gate_requires_report_and_completed_predecessor(self):
        self.task('A')
        self.task('B', 'completed', depends=('A',), marks=('x',))
        report = self.evidence('B')
        with self.assertRaisesRegex(ValueError, '前置任务'):
            store.dashboard(self.root)
        self.task('A', 'completed', marks=('x',))
        self.evidence('A')
        report.unlink()
        with self.assertRaisesRegex(ValueError, '报告不存在'):
            store.dashboard(self.root)

    def test_bad_todo_or_missing_document_fails_whole_snapshot(self):
        self.task('A')
        self.order([])
        with self.assertRaisesRegex(ValueError, 'TODO 必须完整'):
            store.dashboard(self.root)
        self.order(['A'])
        (self.docs / '职责' / 'A.md').unlink()
        with self.assertRaisesRegex(ValueError, '对应文档不存在'):
            store.dashboard(self.root)

    def test_cli_envelope_read_only_and_execution_legacy_schema(self):
        self.task('A')
        before = self.snapshot()
        code, dashboard = self.cli(PLANNING / 'planning_tool.py', 'dashboard', '--root', self.root)
        self.assertEqual(code, 0)
        self.assertTrue(dashboard['ok'])
        code, show = self.cli(EXECUTION / 'execution_tool.py', 'show', '--entry', self.root / 'README.md', '--id', 'A')
        self.assertEqual(code, 0)
        self.assertEqual(set(show['result']), DETAIL_KEYS)
        code, next_value = self.cli(EXECUTION / 'execution_tool.py', 'next', '--entry', self.root / 'README.md')
        self.assertEqual(code, 0)
        self.assertEqual(set(next_value['result']), {'ready', 'next', 'remaining'})
        self.assertEqual(set(next_value['result']['next']), DETAIL_KEYS)
        code, listed = self.cli(PLANNING / 'planning_tool.py', 'list', '--root', self.root)
        self.assertEqual(code, 0)
        self.assertEqual(set(listed['result']['tasks'][0]), {'id', 'class', 'status', 'file', 'depends_on'})
        self.assertEqual(before, self.snapshot())

    def test_invalid_dependency_graphs_and_duplicate_ids_fail_closed(self):
        self.task('A')
        self.task('B', depends=('A',))
        original = self.paths['A'].read_text(encoding='utf-8')
        for replacement, expected in [('depends_on: ["missing"]', '前置不存在'), ('depends_on: ["B"]', '存在循环')]:
            with self.subTest(graph=replacement):
                self.paths['A'].write_text(original.replace('depends_on: []', replacement), encoding='utf-8')
                with self.assertRaisesRegex(ValueError, expected):
                    store.dashboard(self.root)
        self.paths['A'].write_text(original, encoding='utf-8')
        path = self.paths['B']
        path.write_text(path.read_text(encoding='utf-8').replace('task_id: "B"', 'task_id: "A"'), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '重复任务 ID'):
            store.dashboard(self.root)

    def test_bad_record_and_mirror_fail_whole_snapshot(self):
        self.task('A')
        path = self.paths['A']
        original = path.read_text(encoding='utf-8')
        path.write_text(original + '\n', encoding='utf-8')
        task = store.read(path)
        task['body'] = store.replace_section(task['body'], '测试过程', store.HEADER + '\n| bad | row |')
        store.save(task)
        with self.assertRaisesRegex(ValueError, '七个非空字段'):
            store.dashboard(self.root)
        path.write_text(original, encoding='utf-8')
        moved = path.with_name('Wrong.md')
        moved.write_bytes(path.read_bytes())
        path.unlink()
        with self.assertRaisesRegex(ValueError, '必须镜像'):
            store.dashboard(self.root)

    def test_cli_failure_envelope_and_missing_todo_never_repair_readme(self):
        self.task('A')
        readme = self.root / 'README.md'
        readme.write_text('# no structured TODO\n', encoding='utf-8')
        before = self.snapshot()
        code, value = self.cli(PLANNING / 'planning_tool.py', 'dashboard', '--root', self.root)
        self.assertEqual(code, 1)
        self.assertEqual(set(value), {'ok', 'error'})
        self.assertFalse(value['ok'])
        self.assertIn('结构化 TODO', value['error'])
        self.assertEqual(before, self.snapshot())

    def test_real_mid_read_file_change_is_detected_and_retried(self):
        self.task('A')
        original = store.todo_order
        calls = []
        def read_then_change(root):
            value = original(root)
            calls.append(True)
            if len(calls) == 1:
                readme = self.docs / 'README.md'
                readme.write_text('[目录](目录架构.md) concurrent update', encoding='utf-8')
            return value
        with patch.object(store, 'todo_order', side_effect=read_then_change):
            value = store.dashboard(self.root)
        self.assertEqual(len(calls), 2)
        self.assertEqual(value['consistency'], {'stable': True})

    def test_completed_legacy_format_is_not_grandfathered(self):
        task = self.task('A', 'completed', marks=('x',))
        meta = {key: value for key, value in task['meta'].items() if key != 'required_acceptance'}
        front = '\n'.join(f'{key}: {json.dumps(value, ensure_ascii=False)}' for key, value in meta.items())
        body = '# A\n\n## 目标\n\nlegacy\n\n## 任务内容\n\n- [x] old\n\n## 测试过程\n\n' + store.HEADER + '\n'
        task['path'].write_text('---\n' + front + '\n---\n' + body, encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '旧版空泛任务'):
            store.dashboard(self.root)

    def test_claim_owner_enforcement_and_lock_refusal(self):
        self.task('A')
        entry = self.root / 'README.md'
        code, value = self.cli(EXECUTION / 'execution_tool.py', 'claim', '--entry', entry, '--owner', 'alice')
        self.assertEqual(code, 0)
        self.assertEqual(value['result']['claim']['owner'], 'alice')
        before = self.snapshot()
        code, denied = self.cli(EXECUTION / 'execution_tool.py', 'set-item', '--entry', entry, '--id', 'A', '--owner', 'bob', '--number', '1', '--value', 'done')
        self.assertEqual(code, 1)
        self.assertFalse(denied['ok'])
        self.assertEqual(before, self.snapshot())
        lock = self.root / '.execution.lock'
        lock.write_text('held', encoding='utf-8')
        code, denied = self.cli(EXECUTION / 'execution_tool.py', 'release', '--entry', entry, '--id', 'A', '--owner', 'alice', '--reason', 'stop')
        self.assertEqual(code, 1)
        self.assertIn('正在被操作', denied['error'])
        self.assertEqual(lock.read_text(encoding='utf-8'), 'held')


if __name__ == '__main__':
    unittest.main()
