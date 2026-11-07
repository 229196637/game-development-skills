"""Tempfile-only API checks and migration regressions.
Run: python -B -m unittest discover -s tests/api-documents -v.
WORKORDER_SKILLS_ROOT is the parent containing the installed skills; no installation occurs.
Requires the same PyYAML dependency as the documentation tools.
"""
from contextlib import redirect_stdout
import importlib
import io
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
SCRIPTS = SKILLS / 'game-system-development-documentation' / 'scripts'
sys.path.insert(0, str(SCRIPTS))
api = importlib.import_module('api_markdown')
doc = importlib.import_module('documentation_tool')
migration = importlib.import_module('migrate_api_documents')
STAMP = '2026-11-07 10:00:00 +08:00'
LANGUAGES = {'cs': ('C#', 'csharp', 'public class Widget { public void Run(); }'), 'ts': ('TypeScript', 'typescript', 'export declare function run(value: string): void;'), 'py': ('Python', 'python', 'def run(value: str) -> None:\n    ...')}


class ApiDocumentsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='api-documents-regression-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'docs'
        self.module = self.root / '文档' / '模块'
        self.module.mkdir(parents=True)
        (self.module / 'README.md').write_text('[目录](目录架构.md)', encoding='utf-8')
        (self.module / '目录架构.md').write_text('# 目录架构\n', encoding='utf-8')
        self.owner = self.module / '职责' / 'Widget.md'
        self.owner.parent.mkdir()
        self.owner.write_text('# Widget\n\n## 使用契约\n\n保留所有权与取消语义。\n', encoding='utf-8')
        (self.base / 'src').mkdir()
        for ext in LANGUAGES:
            (self.base / 'src' / ('Widget.' + ext)).write_text('source fixture', encoding='utf-8')

    def write_api(self, ext='py', state='implemented', design=False, changes=None, code=None, fence=None):
        language, tag, declaration = LANGUAGES[ext]
        directory = self.module / ('设计/测试任务' if design else '') / 'api' / 'shared'
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / ('Widget.' + ext + '.api.md')
        fields = {'System': '模块', 'Side': 'shared', 'Language': language, 'Namespace/Module': 'Example', 'Source': 'src/Widget.' + ext, 'CodeRevision': 'working-tree', 'Status': state, 'Updated': STAMP, 'Verification': '静态核对签名，不声称运行验证', 'Responsibility': Path(os.path.relpath(self.owner, path.parent)).as_posix() + '#使用契约'}
        fields.update(changes or {})
        import yaml
        text = '---\n' + yaml.safe_dump(fields, allow_unicode=True, sort_keys=False) + '---\n# Widget API\n\n```' + (fence or tag) + '\n' + (declaration if code is None else code) + '\n```\n'
        path.write_text(text, encoding='utf-8')
        return path

    def check(self, path, profile='implemented'):
        process = subprocess.run([sys.executable, '-B', str(SCRIPTS / 'documentation_tool.py'), 'check', str(path), '--mode', profile, '--project-root', str(self.base)], cwd=self.base, capture_output=True, encoding='utf-8', env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONIOENCODING': 'utf-8'})
        self.assertIn(process.returncode, (0, 1), process.stdout + process.stderr)
        value = json.loads(process.stdout)
        return process.returncode, {item['rule'] for item in value.get('issues', [])}, value

    def snapshot(self):
        return {str(p.relative_to(self.base)): (p.read_bytes(), p.stat().st_mtime_ns) for p in self.base.rglob('*') if p.is_file()}

    def legacy(self, ext='py', state='implemented', design=False, name='Widget'):
        language, _, declaration = LANGUAGES[ext]
        suffix = {'cs': 'api.cs', 'ts': 'api.d.ts', 'py': 'api.pyi'}[ext]
        parent = self.module / ('设计/测试任务' if design else '') / 'api' / 'shared'
        parent.mkdir(parents=True, exist_ok=True)
        path = parent / (name + '.' + suffix)
        prefix = '#' if ext == 'py' else '//'
        headers = {'System': '模块', 'Side': 'shared', 'Language': language, 'Namespace/Module': 'Example', 'Source': 'src/Widget.' + ext, 'CodeRevision': 'working-tree', 'Status': state, 'Updated': STAMP, 'Verification': '静态核对'}
        text = '\n'.join(f'{prefix} {key}: {value}' for key, value in headers.items())
        text += '\n' + prefix + ' Owner must release once; cancellation preserves pending operations.\n' + declaration + '\n'
        path.write_text(text, encoding='utf-8')
        with self.owner.open('a', encoding='utf-8') as stream:
            stream.write('\n[API](<' + Path(os.path.relpath(path, self.owner.parent)).as_posix() + '>)\n')
        return path

    def migrate_cli(self, apply=False):
        output = io.StringIO()
        with redirect_stdout(output):
            code = migration.main([str(self.root)] + (['--apply'] if apply else []))
        return code, json.loads(output.getvalue())

    def test_three_languages_both_profiles_use_api_specific_meta(self):
        for ext in LANGUAGES:
            for profile in ('implemented', 'planning'):
                with self.subTest(language=ext, profile=profile):
                    path = self.write_api(ext)
                    before = self.snapshot()
                    code, rules, value = self.check(path, profile)
                    self.assertEqual(code, 0, value)
                    self.assertEqual(rules, set())
                    self.assertEqual(before, self.snapshot())

    def test_planned_and_mixed_remain_in_design_in_both_profiles(self):
        for state in ('planned', 'mixed'):
            for profile in ('implemented', 'planning'):
                with self.subTest(state=state, profile=profile):
                    code = '# planned\ndef run() -> None:\n    ...' if state == 'mixed' else None
                    path = self.write_api(state=state, design=True, code=code)
                    self.assertEqual(self.check(path, profile)[0], 0)
                    path = self.write_api(state=state, design=False, code=code)
                    self.assertIn('API_HANDOFF', self.check(path, profile)[1])

    def test_bad_header_types_unknown_keys_duplicate_yaml_and_invalid_date(self):
        for changes, expected in [({'System': 1}, 'API_HEADER'), ({'unexpected': 'x'}, 'API_META'), ({'Updated': '2026-02-30 00:00:00 +00:00'}, 'API_UPDATED_TIME'), ({'Status': 'done'}, 'API_STATUS'), ({'Language': 'C#'}, 'API_LANGUAGE'), ({'Side': 'client'}, 'API_SIDE')]:
            with self.subTest(changes=changes):
                path = self.write_api(changes=changes)
                self.assertIn(expected, self.check(path)[1])
        path = self.write_api()
        path.write_text(path.read_text(encoding='utf-8').replace('System: 模块', 'System: 模块\nSystem: 重复'), encoding='utf-8')
        self.assertIn('API_META', self.check(path)[1])

    def test_responsibility_requires_real_file_heading_and_role(self):
        for target, expected in [('../../职责/missing.md#使用契约', 'LINK'), ('../../职责/Widget.md#missing', 'ANCHOR'), ('../../README.md', 'API_RESPONSIBILITY')]:
            with self.subTest(target=target):
                path = self.write_api(changes={'Responsibility': target})
                self.assertIn(expected, self.check(path)[1])

    def test_source_must_be_relative_and_implemented_file_must_exist(self):
        for source in ('../escape.py', '/absolute.py', 'C:/source.py', 'src/missing.py'):
            with self.subTest(source=source):
                self.assertIn('API_SOURCE', self.check(self.write_api(changes={'Source': source}))[1])
        self.assertEqual(self.check(self.write_api(state='planned', design=True, changes={'Source': 'src/not-yet-created.py'}))[0], 0)

    def test_wrong_fence_and_missing_signature_fence_are_rejected(self):
        self.assertIn('API_FENCE', self.check(self.write_api(fence='typescript'))[1])
        path = self.write_api()
        path.write_text(path.read_text(encoding='utf-8').split('```')[0], encoding='utf-8')
        self.assertIn('API_FENCE', self.check(path)[1])

    def test_private_members_properties_and_bodies_rejected_in_three_languages(self):
        cases = [('cs', 'public class Widget { private void Run(); }', 'API_MEMBER'), ('cs', 'public class Widget { public int Value { get; set; } public void Run(); }', 'API_MEMBER'), ('cs', 'public class Widget { public void Run() { } }', 'API_BODY'), ('ts', 'export class Widget { private run(): void; }', 'API_MEMBER'), ('ts', 'export function run() { return 1; }', 'API_BODY'), ('py', 'def _hidden():\n    ...', 'API_MEMBER'), ('py', 'def run():\n    pass', 'API_BODY'), ('py', 'class Widget:\n    @property\n    def value(self):\n        ...', 'API_MEMBER')]
        for ext, code, expected in cases:
            with self.subTest(language=ext, code=code):
                self.assertIn(expected, self.check(self.write_api(ext, code=code))[1])

    def test_mixed_requires_per_function_state_not_one_file_notice(self):
        path = self.write_api(state='mixed', design=True, code='# implemented\ndef first():\n    ...\ndef second():\n    ...')
        self.assertIn('API_MIXED', self.check(path)[1])
        path = self.write_api(state='mixed', design=True, code='# implemented\ndef first():\n    ...\n# planned\ndef second():\n    ...')
        self.assertEqual(self.check(path)[0], 0)

    def test_detailed_workflows_and_test_results_do_not_belong_in_api(self):
        for heading in ('生命周期', '内部协作', '测试', '验收'):
            with self.subTest(heading=heading):
                path = self.write_api()
                with path.open('a', encoding='utf-8') as stream:
                    stream.write('\n## ' + heading + '\n长说明\n')
                self.assertIn('API_SCOPE', self.check(path)[1])

    def test_legacy_document_declarations_are_rejected_by_both_profiles(self):
        path = self.legacy()
        for profile in ('implemented', 'planning'):
            self.assertIn('API_LEGACY', self.check(path, profile)[1])

    def test_migration_default_dry_run_never_changes_bytes_or_timestamps(self):
        for ext in LANGUAGES:
            self.legacy(ext)
        before = self.snapshot()
        code, result = self.migrate_cli()
        self.assertEqual(code, 0, result)
        self.assertTrue(result['dry_run'])
        self.assertEqual(len(result['deletes']), 3)
        self.assertEqual(before, self.snapshot())

    def test_apply_three_languages_preserves_contracts_rewrites_all_refs_and_is_idempotent(self):
        old = [self.legacy(ext) for ext in LANGUAGES]
        relative = Path(os.path.relpath(old[0], self.root)).as_posix()
        for name, text in [('README.md', f'[API]({relative}#member)\n'), ('links.yaml', f'api: {relative}\n'), ('graph.mmd', f'flowchart TD\n A[API]\n click A "{relative}"\n'), ('links.json', json.dumps({'api': relative}, ensure_ascii=False))]:
            (self.root / name).write_text(text, encoding='utf-8')
        code, result = self.migrate_cli(apply=True)
        self.assertEqual(code, 0, result)
        self.assertFalse(result['dry_run'])
        self.assertTrue(all(not path.exists() for path in old))
        for ext in LANGUAGES:
            target = old[list(LANGUAGES).index(ext)].with_name('Widget.' + ext + '.api.md')
            self.assertTrue(target.is_file())
            self.assertEqual(self.check(target)[0], 0)
        owner = self.owner.read_text(encoding='utf-8')
        self.assertEqual(owner.count('Owner must release once; cancellation preserves pending operations.'), 3)
        for path in self.root.rglob('*'):
            if path.is_file():
                for legacy in old:
                    self.assertNotIn(legacy.name, path.read_text(encoding='utf-8'))
        before = self.snapshot()
        code, result = self.migrate_cli(apply=True)
        self.assertEqual(code, 0, result)
        self.assertEqual(result['writes'], [])
        self.assertEqual(result['deletes'], [])
        self.assertEqual(before, self.snapshot())

    def test_target_conflict_aborts_entire_batch_without_writes(self):
        self.legacy('cs')
        old = self.legacy('py')
        old.with_name('Widget.py.api.md').write_text('user file must not be overwritten', encoding='utf-8')
        before = self.snapshot()
        code, value = self.migrate_cli(apply=True)
        self.assertEqual(code, 2)
        self.assertIn('target conflict', value['error'])
        self.assertEqual(before, self.snapshot())

    def test_ambiguous_responsibility_and_unresolved_reference_refuse_without_writes(self):
        old = self.legacy()
        extra = self.owner.with_name('Other.md')
        extra.write_text(self.owner.read_text(encoding='utf-8'), encoding='utf-8')
        before = self.snapshot()
        code, value = self.migrate_cli(apply=True)
        self.assertEqual(code, 2)
        self.assertIn('exactly one', value['error'])
        self.assertEqual(before, self.snapshot())
        extra.unlink()
        (self.root / 'README.md').write_text('Unresolvable bare old filename: ' + old.name, encoding='utf-8')
        before = self.snapshot()
        code, value = self.migrate_cli(apply=True)
        self.assertEqual(code, 2)
        self.assertIn('unresolved legacy reference', value['error'])
        self.assertEqual(before, self.snapshot())

    def test_unsafe_body_and_duplicate_legacy_header_refuse_without_writes(self):
        old = self.legacy()
        original = old.read_text(encoding='utf-8')
        for text, message in [(original.replace('    ...', '    return None'), 'unsafe declaration'), (original + '# System: duplicate\n', 'duplicate legacy header')]:
            with self.subTest(message=message):
                old.write_text(text, encoding='utf-8')
                before = self.snapshot()
                code, result = self.migrate_cli(apply=True)
                self.assertEqual(code, 2)
                self.assertIn(message, result['error'])
                self.assertEqual(before, self.snapshot())

    def test_rollback_restores_updated_created_and_deleted_bytes(self):
        old = self.legacy()
        changes, deletions = migration.plan(self.root)
        before = {p: p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        real_unlink = Path.unlink
        fired = []
        def fail_once(path, *args, **kwargs):
            if path == old and not fired:
                fired.append(True)
                # Delete before failure exercises restoration of actually deleted bytes.
                real_unlink(path, *args, **kwargs)
                raise OSError('injected deletion failure')
            return real_unlink(path, *args, **kwargs)
        with patch.object(Path, 'unlink', fail_once):
            with self.assertRaisesRegex(OSError, 'injected deletion failure'):
                migration.apply_transaction(changes, deletions)
        after = {p: p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(before, after)
        self.assertTrue(fired)
        migration.apply_transaction(*migration.plan(self.root))
        self.assertFalse(old.exists())

    def test_migration_keeps_unfinished_files_in_design_and_preserves_python_docstrings(self):
        for state in ('planned', 'mixed'):
            old = self.legacy('py', state=state, design=True, name=state + 'Widget')
            text = old.read_text(encoding='utf-8')
            declaration = 'def run(value: str) -> None:\n    """' + ('planned ' if state == 'mixed' else '') + 'First purpose.\n    Cancellation preserves ownership; release exactly once.\n    """\n    ...'
            old.write_text(text.replace(LANGUAGES['py'][2], declaration), encoding='utf-8')
        code, value = self.migrate_cli(apply=True)
        self.assertEqual(code, 0, value)
        for state in ('planned', 'mixed'):
            target = self.module / '设计' / '测试任务' / 'api' / 'shared' / (state + 'Widget.py.api.md')
            self.assertTrue(target.is_file())
            self.assertIn('Status: ' + state, target.read_text(encoding='utf-8'))
            self.assertEqual(self.check(target, 'planning')[0], 0)
        owner = self.owner.read_text(encoding='utf-8')
        self.assertEqual(owner.count('Cancellation preserves ownership; release exactly once.'), 2)

    def test_write_failure_rolls_back_partial_changes_before_retry(self):
        self.legacy()
        changes, deletions = migration.plan(self.root)
        before = {p: p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        real_write = Path.write_text
        calls = []
        def fail_second(path, *args, **kwargs):
            calls.append(path)
            if len(calls) == 2:
                raise OSError('injected write failure')
            return real_write(path, *args, **kwargs)
        with patch.object(Path, 'write_text', fail_second):
            with self.assertRaisesRegex(OSError, 'injected write failure'):
                migration.apply_transaction(changes, deletions)
        self.assertEqual(before, {p: p.read_bytes() for p in self.root.rglob('*') if p.is_file()})

    def test_encoded_unicode_json_reference_refuses_safely_instead_of_deleting_source(self):
        old = self.legacy()
        relative = Path(os.path.relpath(old, self.root)).as_posix()
        # The bounded token rewriter does not decode JSON Unicode escapes. Fail closed.
        (self.root / 'escaped.json').write_text(json.dumps({'api': relative}), encoding='utf-8')
        before = self.snapshot()
        code, value = self.migrate_cli(apply=True)
        self.assertEqual(code, 2)
        self.assertIn('unresolved legacy reference', value['error'])
        self.assertEqual(before, self.snapshot())

    def test_authorized_docs_root_and_sdk_exclusion_are_enforced(self):
        with self.assertRaisesRegex(ValueError, 'explicit documentation root'):
            migration.plan(self.base)
        old = self.legacy()
        sdk = self.module / 'SDK' / 'api' / 'shared'
        sdk.mkdir(parents=True)
        (sdk / old.name).write_bytes(old.read_bytes())
        before = self.snapshot()
        code, result = self.migrate_cli(apply=True)
        self.assertEqual(code, 2)
        self.assertIn('SDK/cache/source excluded', result['error'])
        self.assertEqual(before, self.snapshot())


if __name__ == '__main__':
    unittest.main()
