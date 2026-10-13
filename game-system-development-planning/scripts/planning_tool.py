"""统一任务工具：调用文档技能检查产物，本技能仅校验 TODO 依赖与执行顺序。"""
import argparse
import json
import re
import subprocess
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
import os
from pathlib import Path


def todo_issues(path):
    issues=[]
    def fail(file, code, message, line=1):
        issues.append({'file':str(file),'line':line,'rule':code,'message':message})
    files=[path] if path.is_file() else sorted(path.rglob('*.md'))
    for file in files:
        if not file.is_file() or '.git' in file.parts or 'templates' in file.parts:
            continue
        body=file.read_text(encoding='utf-8-sig')
        todo_section = re.search(r'^## TODO 与执行顺序\s*\n(.*?)(?=^## |\Z)', body, re.S | re.M)
        if todo_section:
            rows = [line.strip() for line in todo_section[1].splitlines() if line.strip().startswith('|')]
            cells = lambda row: [c.strip() for c in re.split(r'(?<!\\)\|', row.strip('|'))]
            required = ['顺序', 'ID', '前置 ID', '状态']
            if len(rows) < 3 or any(h not in cells(rows[0]) for h in required):
                fail(file, 'TODO_TABLE', 'TODO requires order, ID, dependencies, status and data rows')
            else:
                headers = cells(rows[0])
                tasks = {}
                previous_order = 0
                for row in rows[2:]:
                    values = cells(row)
                    if len(values) != len(headers):
                        fail(file, 'TODO_COLUMNS', 'TODO row/header column counts differ')
                        continue
                    item = dict(zip(headers, values))
                    task_id = item['ID']
                    if not task_id or task_id in tasks:
                        fail(file, 'TODO_ID', 'empty or duplicate TODO ID: ' + task_id)
                        continue
                    try:
                        order = int(item['顺序'])
                        if order < 1:
                            raise ValueError()
                    except ValueError:
                        fail(file, 'TODO_ORDER', 'order must be a positive integer: ' + task_id)
                        continue
                    if order < previous_order:
                        fail(file, 'TODO_ORDER', 'table must follow ascending execution order: ' + task_id)
                    previous_order = order
                    deps = [] if item['前置 ID'] in {'—', '-', '无', ''} else re.split(r'[,，、\s]+', item['前置 ID'])
                    if item['状态'] not in {'todo', 'doing', 'implemented', 'verified', 'accepted', 'blocked', 'cancelled'}:
                        fail(file, 'TODO_STATUS', 'invalid task state: ' + task_id)
                    tasks[task_id] = (order, deps, item['状态'])
                edges = {task_id: set() for task_id in tasks}
                for task_id, (order, deps, state) in tasks.items():
                    for dep in deps:
                        if dep not in tasks:
                            fail(file, 'TODO_DEPENDENCY', 'unknown predecessor: ' + task_id + ' -> ' + dep)
                            continue
                        edges[task_id].add(dep)
                        if tasks[dep][0] >= order:
                            fail(file, 'TODO_ORDER', 'predecessor must have lower order: ' + task_id + ' -> ' + dep)
                        if state not in {'cancelled', 'blocked'} and tasks[dep][2] == 'cancelled':
                            fail(file, 'TODO_DEPENDENCY', 'active task depends on cancelled predecessor: ' + task_id + ' -> ' + dep)
                remaining = {key: set(value) for key, value in edges.items()}
                while remaining:
                    ready = {key for key, deps in remaining.items() if not deps}
                    if not ready:
                        fail(file, 'TODO_CYCLE', 'cyclic TODO dependencies: ' + ', '.join(sorted(remaining)))
                        break
                    remaining = {key: deps - ready for key, deps in remaining.items() if key not in ready}
    return issues


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    sub.add_parser('rules')
    check=sub.add_parser('check')
    check.add_argument('path')
    check.add_argument('--project-root')
    check.add_argument('--mode',choices=['planning','implemented'],default='planning')
    args=parser.parse_args()
    document_tool=Path(__file__).resolve().parents[2]/'game-system-development-documentation/scripts/documentation_tool.py'
    try:
        if not document_tool.is_file():
            raise ValueError('required documentation skill is missing: '+str(document_tool))
        if args.command=='rules':
            print(json.dumps({'kind':'task-orchestration','read_only':True,'documentation_tool':str(document_tool),'task_rules':['stable TODO IDs','predecessors before consumers','no unknown/cancelled blockers','no dependency cycles']},ensure_ascii=False,indent=2))
            return 0
        path=Path(args.path).resolve()
        if not path.exists():raise ValueError('target does not exist')
        command=[sys.executable,str(document_tool),'check',str(path),'--mode',args.mode]
        if args.project_root:command.extend(['--project-root',args.project_root])
        result=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',env={**os.environ,'PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8'})
        data=json.loads(result.stdout)
        if result.returncode==2:
            print(json.dumps(data,ensure_ascii=False,indent=2));return 2
        data['issues']=data.get('issues',[])+todo_issues(path)
        data['ok']=not data['issues']
        data['documentation_owner']='game-system-development-documentation'
        data['todo_owner']='game-system-development-planning'
        print(json.dumps(data,ensure_ascii=False,indent=2))
        return 0 if data['ok'] else 1
    except Exception as exc:
        print(json.dumps({'ok':False,'error':str(exc),'exception':type(exc).__name__},ensure_ascii=False,indent=2));return 2

if __name__=='__main__':raise SystemExit(main())
