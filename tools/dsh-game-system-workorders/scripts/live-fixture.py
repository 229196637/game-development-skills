"""Owned fixture for installed-plugin reads. Never touches project workorders."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parents[1]
ROOT = BASE / 'tests' / 'runtime-check'
MARKER = '.workorders-fixture-owned'
TOKEN = 'dsh-game-workorders-runtime-check-v1'


def files():
    return {str(p.relative_to(ROOT)): [hashlib.sha256(p.read_bytes()).hexdigest(), p.stat().st_mtime_ns]
            for p in ROOT.rglob('*') if p.is_file() and p.name not in (MARKER, '.baseline.json')}


def owned():
    if ROOT.resolve() != BASE / 'tests' / 'runtime-check' or ROOT.is_symlink():
        raise RuntimeError('Unexpected fixture path')
    if (ROOT / MARKER).read_text(encoding='utf-8') != TOKEN:
        raise RuntimeError('Fixture ownership marker does not match')


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    if action == 'create':
        if ROOT.exists():
            raise RuntimeError('Fixture already exists; refusing to overwrite')
        spec = importlib.util.spec_from_file_location('dashboard_fixture', BASE / 'tests' / 'workorders' / 'test_dashboard.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        fixture = module.DashboardTests()
        fixture.setUp()
        try:
            fixture.task('LiveBase', marks=('x', ' '))
            fixture.task('LiveDependent', 'blocked', depends=('LiveBase',))
            shutil.copytree(fixture.base, ROOT)
            (ROOT / MARKER).write_text(TOKEN, encoding='utf-8')
            (ROOT / '.baseline.json').write_text(json.dumps(files(), ensure_ascii=False), encoding='utf-8')
        finally:
            fixture.doCleanups()
        print(json.dumps({'root': str(ROOT), 'task': str(ROOT / 'docs' / '规划' / '隔离任务')}, ensure_ascii=False))
    elif action in ('check', 'cleanup'):
        owned()
        if files() != json.loads((ROOT / '.baseline.json').read_text(encoding='utf-8')):
            raise RuntimeError('Installed-plugin query changed fixture bytes or timestamps')
        if action == 'cleanup':
            shutil.rmtree(ROOT)
        print(json.dumps({'readOnly': True, 'removed': action == 'cleanup'}))
    else:
        raise RuntimeError('Expected create, check or cleanup')


if __name__ == '__main__':
    main()
