"""Behavioral tests use temporary fixtures outside the production project."""
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1] / 'skill_tool.py'
SPEC = importlib.util.spec_from_file_location('skill_tool', TOOL)
ENGINE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ENGINE)
META = '''---
system: fixture
side: [client]
updated: '2026-10-12'
code_revision: working-tree
sources: []
dependencies: []
---
'''
BODY = '''# Fixture
## 架构
```mermaid
flowchart TD
 A["Owner"] --> B["Borrowed"]
```
## 生命周期
由 owner 创建和释放，调用方借用。
'''


class ToolTests(unittest.TestCase):
    def setUp(self):
        base = os.environ.get('SKILL_TOOL_TEST_ROOT')
        if base:
            Path(base).mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='skill-tools-', dir=base)
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')
        return path

    def run_tool(self, *args):
        env = dict(os.environ, PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1')
        p = subprocess.run([sys.executable, str(TOOL), *map(str, args)],
                           capture_output=True, text=True, encoding='utf-8', env=env)
        return p.returncode, json.loads(p.stdout)

    def document(self, text=META + BODY, *options):
        p = self.write('module.md', text)
        return self.run_tool('check', p, '--kind', 'documentation', *options)

    def test_valid_document_is_read_only(self):
        p = self.write('module.md', META + BODY)
        before = hashlib.sha256(p.read_bytes()).digest()
        code, data = self.run_tool('check', p)
        self.assertEqual(code, 0, data)
        self.assertEqual(hashlib.sha256(p.read_bytes()).digest(), before)

    def test_portable_skill_copies_match_canonical_source(self):
        repo = TOOL.parent.parent
        for name in ['game-system-development-planning', 'game-system-development-documentation', 'game-excel-config', 'log-reading']:
            self.assertEqual((repo / name / 'scripts/skill_tool.py').read_bytes(), TOOL.read_bytes())

    def test_duplicate_yaml_key_rejected(self):
        code, data = self.document(META.replace('side: [client]', 'side: [client]\nside: [server]') + BODY)
        self.assertEqual(code, 1)
        self.assertEqual(data['issues'][0]['rule'], 'META')

    def test_invalid_calendar_date_rejected(self):
        code, data = self.document((META + BODY).replace('2026-10-12', '2026-02-30'))
        self.assertEqual(code, 1)
        self.assertIn('DATE', [i['rule'] for i in data['issues']])

    def test_extra_meta_field_requires_explicit_extension(self):
        text = META.replace('sources: []', 'sources: []\nlayout_version: 2') + BODY
        code, _ = self.document(text)
        self.assertEqual(code, 1)
        code, data = self.document(text, '--allow-meta-field', 'layout_version')
        self.assertEqual(code, 0, data)

    def test_document_dependency_is_checked(self):
        self.write('dep.md', '# Dependency\n')
        text = META.replace('dependencies: []', 'dependencies:\n- document: dep.md\n  uses: 模式数据') + BODY
        self.assertEqual(self.document(text)[0], 0)
        (self.root / 'dep.md').unlink()
        self.assertEqual(self.document(text)[0], 1)

    def test_dependency_requires_uses(self):
        self.write('dep.md', '# Dependency\n')
        text = META.replace('dependencies: []', 'dependencies:\n- document: dep.md') + BODY
        self.assertEqual(self.document(text)[0], 1)

    def test_tests_not_allowed_in_document(self):
        code, data = self.document(META + BODY + '\n## 测试结果\npassed\n')
        self.assertEqual(code, 1)
        self.assertIn('TEST_SECTION', [i['rule'] for i in data['issues']])

    def test_test_report_is_not_dependency(self):
        self.write('verification.md', '# Tests\n')
        text = META.replace('dependencies: []', 'dependencies:\n- document: verification.md\n  uses: 验收') + BODY
        self.assertEqual(self.document(text)[0], 1)

    def test_missing_link_and_anchor(self):
        self.write('target.md', '# Present\n')
        self.assertEqual(self.document(META + BODY + '\n[x](target.md#absent)')[0], 1)
        self.assertEqual(self.document(META + BODY + '\n[x](missing.md)')[0], 1)

    def test_graph_click_target_name_checked(self):
        self.write('reference.md', '# Guide\n')
        self.assertEqual(self.document(META + BODY.replace('Owner', 'Guide').replace(' A[', ' click A "reference.md"\n A['))[0], 0)
        self.assertEqual(self.document(META + BODY.replace(' A[', ' click A "reference.md"\n A['))[0], 1)

    def test_source_paths_confined_to_project_root(self):
        project = self.root / 'project'
        project.mkdir()
        text = META.replace('sources: []', 'sources: [../outside.cs]') + BODY
        code, data = self.document(text, '--project-root', str(project))
        self.assertEqual(code, 1)
        self.assertIn('SOURCE_PATH', [i['rule'] for i in data['issues']])

    def test_reference_api_directory_is_not_output_api(self):
        p = self.write('references/api/guide.md', '---\nname: api-guide\ndescription: guide\n---\n# API\n')
        code, data = self.run_tool('check', p)
        self.assertEqual(code, 0, data)

    def test_api_manifest_rejected(self):
        p = self.write('api/client/module/manifest.json', '{}')
        code, data = self.run_tool('check', p)
        self.assertEqual(code, 1)
        self.assertEqual(data['issues'][0]['rule'], 'API_DIRECTORY')

    def test_unfinished_api_cannot_be_formal(self):
        headers = '\n'.join('// '+k+': '+v for k, v in {'System':'test','Side':'client','Language':'C#','Source':'src/a.cs','CodeRevision':'working-tree','Status':'planned','Updated':'2026-10-12','Verification':'static'}.items())
        p = self.write('文档/api/client/module/a.api.cs', headers + '\npublic class A { public void Run(); }')
        code, data = self.run_tool('check', p)
        self.assertEqual(code, 1)
        self.assertIn('API_HANDOFF', [i['rule'] for i in data['issues']])

    def test_missing_config_returns_plan_without_creating_file(self):
        p = self.root / 'new.xls'
        code, data = self.run_tool('config', p, '--sheet', 'New')
        self.assertEqual(code, 0)
        self.assertFalse(data['exists'])
        self.assertIn('plan', data['next'])
        self.assertFalse(p.exists())

    def test_log_filter_exact_tokens_context_and_bound(self):
        p = self.write('fixture.log', 'Run=Old Request=R1 wrong\nRun=B Request=R10 wrong\nRun=B Request=R1 matching\n ---> InnerException\nRun=B Request=R1 later\n')
        code, data = self.run_tool('logs', p, '--match', 'Run=B', '--match', 'Request=R1', '--context', '1', '--limit', '1')
        self.assertEqual(code, 0)
        self.assertEqual(data['matches'], 1)
        self.assertEqual([r['line'] for r in data['evidence']], [2, 3, 4])
        self.assertTrue(data['evidence'][1]['match'])
        self.assertIn('InnerException', data['evidence'][2]['text'])

    def test_bad_encoding_not_silently_replaced(self):
        p = self.root / 'bad.log'
        p.write_bytes(b'\xff\xff')
        code, data = self.run_tool('logs', p)
        self.assertEqual(code, 2)
        self.assertEqual(data['exception'], 'UnicodeDecodeError')

    def test_empty_scope_not_success(self):
        self.assertEqual(self.run_tool('check', self.root)[0], 1)

    def test_formal_topic_does_not_force_architecture(self):
        p = self.write('ui.md', META + '# UI\n## 生命周期\n关闭解绑。')
        self.assertEqual(self.run_tool('check', p, '--topic')[0], 0)

    def test_config_dictionary_and_actions_checked(self):
        meta = '''---
id: plan.test.config
kind: plan
system: config
title: 配置
status: draft
updated: '2026-10-12'
sources: []
links: []
code_revision: working-tree
---
'''
        body = '''# Config
## 处理清单
复用已有。
## 字段字典
| KEY | TYPE | 注释/TIPS |
| --- | --- | --- |
| Id | int | 稳定编号 |
'''
        p = self.write('config.md', meta + body)
        self.assertEqual(self.run_tool('check', p)[0], 0)
        p.write_text(meta + body.replace('稳定编号', ''), encoding='utf-8')
        self.assertEqual(self.run_tool('check', p)[0], 1)
        p.write_text(meta + body.replace('## 处理清单', '## 其他'), encoding='utf-8')
        self.assertEqual(self.run_tool('check', p)[0], 1)

    def test_tagged_config_side_switch_comments_and_source_values(self):
        rows = [['OUT_CLICNET', 'Demo'], ['OUT_SERVER', 'NO'],
                ['IS_CLIENT', 'YES', 'YES'], ['IS_SERVER', 'YES', 'YES'],
                ['KEY', 'Id', 'WaveIds'], ['TYPE', 'int', 'int[]'],
                ['TIPS', '稳定编号', ''], ['VALUE', 1, '[1,2,1]']]
        data = ENGINE.tagged_config(rows, 'Demo')
        self.assertEqual(data['enabled_field_counts'], {'client': 2, 'server': 0})
        self.assertEqual(data['records'][0]['WaveIds'], '[1,2,1]')
        self.assertEqual(data['issues'], [{'field': 'WaveIds', 'rule': 'MISSING_TIPS'}])
        self.assertNotIn('records', ENGINE.tagged_config(rows, 'Demo', summary=True))

    def test_tagged_config_duplicate_keys_and_tags_rejected(self):
        with self.assertRaises(ValueError):
            ENGINE.tagged_config([['KEY', 'Id'], ['KEY', 'Name'], ['TYPE', 'int']], 'Demo')
        with self.assertRaises(ValueError):
            ENGINE.tagged_config([['KEY', 'Id', 'Id'], ['TYPE', 'int', 'int']], 'Demo')


if __name__ == '__main__':
    unittest.main()
