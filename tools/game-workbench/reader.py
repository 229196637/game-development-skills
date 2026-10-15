"""Read-only projections of planning Markdown. Never imports workflow mutation commands."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
from collections import Counter
import importlib.util
import json
import os
import re
import sys
import yaml

MAX_TEXT = 2 * 1024 * 1024
TEXT = {'.md', '.txt', '.log', '.cs', '.py', '.pyi', '.ts', '.tsx', '.js', '.json', '.yaml', '.yml', '.toml', '.css', '.csv', '.html', '.htm'}
ASSETS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf', '.html', '.htm'}


def json_safe(value, depth=0):
    if depth > 20:
        return '元数据层级过深'
    if isinstance(value, dict):
        return {str(k): json_safe(v, depth + 1) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v, depth + 1) for v in value]
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        import math
        return value if math.isfinite(value) else str(value)
    return str(value)


class Reader:
    def __init__(self, config):
        config = Path(config).resolve()
        settings = json.loads(config.read_text(encoding='utf-8-sig'))
        self.projects = {}
        for item in settings['projects']:
            if not re.fullmatch(r'[a-zA-Z0-9_-]+', item['id']) or item['id'] in self.projects:
                raise ValueError('项目 ID 无效或重复')
            root = Path(item['docs']).expanduser()
            root = (config.parent / root).resolve() if not root.is_absolute() else root.resolve()
            self.projects[item['id']] = {'id': item['id'], 'name': item['name'], 'root': root}
        skill = Path(settings.get('planning_skill', Path.home() / '.codex/skills/game-system-development-planning'))
        skill = skill.expanduser()
        if not skill.is_absolute():
            skill = (config.parent / skill).resolve()
        module = skill / 'scripts/task_store.py'
        if not module.is_file():
            raise ValueError('缺少规划技能 task_store.py，请配置 planning_skill')
        spec = importlib.util.spec_from_file_location('workbench_task_format', module)
        shared = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(shared)
        self.statuses = set(shared.STATUSES)
        self.section = shared.section
        self.keys = shared.KEYS

    def root(self, project):
        return self.projects[project]['root']

    def path(self, project, relative):
        root = self.root(project)
        candidate = Path(relative)
        target = (root / candidate).resolve()
        if not target.is_relative_to(root) or any(p.startswith('.') for p in target.relative_to(root).parts):
            raise PermissionError('路径不在允许阅读的项目 docs 内')
        return target

    def text(self, path):
        if path.stat().st_size > MAX_TEXT:
            raise ValueError('文件大于 2 MiB，请缩小文档或日志')
        return path.read_text(encoding='utf-8-sig')

    def meta(self, raw):
        match = re.match(r'\A---\r?\n(.*?)\r?\n---\r?\n', raw, re.S)
        if not match:
            return {}, raw
        value = yaml.safe_load(match[1])
        if not isinstance(value, dict):
            raise ValueError('meta 必须为对象')
        return value, raw[match.end():]

    def files(self, project, folder):
        root = self.root(project)
        for base, directories, filenames in os.walk(folder, followlinks=False):
            parent = Path(base)
            directories[:] = sorted(name for name in directories if not name.startswith('.')
                                    and not (parent / name).is_symlink()
                                    and not (parent / name).is_junction()
                                    and (parent / name).resolve().is_relative_to(root))
            for name in sorted(filenames):
                if name.startswith('.'):
                    continue
                file = parent / name
                try:
                    safe = self.path(project, file.relative_to(root).as_posix())
                    if safe.is_file():
                        yield safe
                except (OSError, PermissionError):
                    continue

    def listing(self):
        return [{'id': p['id'], 'name': p['name'], 'available': p['root'].is_dir()} for p in self.projects.values()]

    def tree(self, project):
        root = self.root(project)
        if not root.is_dir():
            return []
        output = []
        for base in ['文档', '规划', '测试']:
            folder = self.path(project, base)
            if not folder.is_dir():
                continue
            for file in self.files(project, folder):
                if len(output) >= 5000:
                    break
                if not file.is_file() or file.suffix.lower() not in TEXT or any(p.startswith('.') for p in file.relative_to(root).parts):
                    continue
                try:
                    safe = self.path(project, str(file.relative_to(root)))
                    if safe.is_file():
                        output.append({'path': file.relative_to(root).as_posix(), 'name': file.name})
                except (PermissionError, OSError):
                    continue
        return output

    def groups(self, project):
        folder = self.path(project, '规划')
        if not folder.is_dir():
            return []
        output = []
        for group in sorted(folder.iterdir()):
            if group.name.startswith('.') or not group.is_dir():
                continue
            try:
                self.path(project, str(group.relative_to(self.root(project))))
            except PermissionError:
                continue
            entry = next((group / name for name in ('README.md', 'index.md') if (group / name).is_file()), None)
            output.append({'id': group.name, 'name': group.name, 'entry': entry.relative_to(self.root(project)).as_posix() if entry else None})
        return output

    def rows(self, body, heading, width):
        result = []
        for line in self.section(body, heading).splitlines():
            if not line.strip().startswith('|'):
                continue
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if len(cells) == width and cells[0] != '时间' and not all(re.fullmatch(r'[-: ]+', c) for c in cells):
                result.append(cells)
        return result

    def task(self, project, file):
        issues = []
        relative = file.relative_to(self.root(project)).as_posix()
        raw = self.text(file)
        try:
            meta, body = self.meta(raw)
        except (yaml.YAMLError, ValueError) as error:
            if not re.search(r'^task_id\s*:', raw, re.M):
                return None
            meta, body = {}, raw
            issues.append('meta 无法解析：' + str(error).splitlines()[0])
        if 'task_id' not in meta and not issues:
            return None
        missing = [k for k in self.keys if k not in meta]
        if missing:
            issues.append('缺少字段：' + '、'.join(missing))
        status = meta.get('status')
        if not isinstance(status, str) or status not in self.statuses:
            issues.append('未知状态：' + str(status))
            status = 'unknown'
        identifier = meta.get('task_id', file.stem)
        if not isinstance(identifier, str):
            identifier = file.stem
            issues.append('task_id 必须为文本')
        items = re.findall(r'^- \[([ xX])\] (.+)$', self.section(body, '任务内容'), re.M)
        if not items:
            issues.append('没有可识别工作项')
        deps = meta.get('depends_on', [])
        if not isinstance(deps, list) or not all(isinstance(d, str) for d in deps):
            deps = []
            issues.append('depends_on 格式无效')
        tests = self.rows(body, '测试过程', 7)
        acceptance = self.rows(body, '验收情况', 5)
        def required(field, rows, result_column):
            ids = meta.get(field, [])
            if not isinstance(ids, list) or not all(isinstance(x, str) for x in ids):
                issues.append(field + ' 格式无效')
                ids = []
            latest = {row[1]: row[result_column] for row in rows}
            return [{'id': x, 'result': latest.get(x, 'not-run')} for x in ids]
        tests = required('required_tests', tests, 5)
        acceptance = required('required_acceptance', acceptance, 3)
        done = sum(mark.lower() == 'x' for mark, _ in items)
        complete = (status == 'completed' and bool(items) and done == len(items) and bool(tests) and bool(acceptance)
                    and all(x['result'] == 'passed' for x in tests + acceptance) and not missing)
        if status == 'completed' and not complete:
            issues.append('标记已完成，但工作项、测试或验收记录不完整')
        links = []
        for label, href in re.findall(r'\[([^\]]+)\]\(([^)]+)\)', self.section(body, '文档索引')):
            try:
                resolved = self.resolve(project, relative, href)
                links.append({'label': label, **resolved})
            except (ValueError, PermissionError, FileNotFoundError):
                issues.append('关联文档不可访问：' + label)
        claim = re.search(r'<!-- execution-claim: (.*?) -->', body)
        try:
            claim = json.loads(claim[1]) if claim else None
        except json.JSONDecodeError:
            claim = None
            issues.append('领取信息无法解析')
        return {'id': identifier, 'class_name': str(meta.get('class', file.stem)), 'path': relative, 'status': status,
                'goal': self.section(body, '目标').strip(), 'updated': str(meta.get('updated', '')), 'depends_on': deps,
                'items': [{'done': mark.lower() == 'x', 'text': value} for mark, value in items], 'done': done, 'total': len(items),
                'tests': tests, 'acceptance': acceptance, 'completed': complete, 'links': links, 'claim': claim,
                'issues': issues, 'blocked_by': []}

    def board(self, project, group):
        folder = self.path(project, '规划/' + group)
        if folder.parent != self.path(project, '规划') or not folder.is_dir():
            raise FileNotFoundError('任务不存在')
        tasks, issues = [], []
        document_count = 0
        for file in self.files(project, folder):
            if file.suffix.lower() != '.md':
                continue
            if file.name.lower() in {'readme.md', 'index.md'}:
                continue
            document_count += 1
            try:
                safe = self.path(project, file.relative_to(self.root(project)).as_posix())
                task = self.task(project, safe)
                if task:
                    tasks.append(task)
            except (OSError, ValueError, PermissionError) as error:
                issues.append(file.name + '：' + str(error))
        if not tasks and document_count:
            issues.append('该目录仅发现旧格式规划资料或说明文档，未发现标准 task_id 工单；不推算完成率')
        entry = next((folder / name for name in ('README.md', 'index.md') if (folder / name).is_file()), None)
        order = []
        if entry:
            text = self.text(entry)
            match = re.search(r'<!-- planning-todo:begin -->(.*?)<!-- planning-todo:end -->', text, re.S)
            if match:
                for line in match[1].splitlines():
                    cells = [c.strip() for c in line.strip().strip('|').split('|')]
                    if len(cells) == 3 and cells[0].isdigit():
                        order.append(cells[1])
            else:
                issues.append('入口没有结构化 TODO，暂按文件路径显示；没有修改原文档')
        else:
            issues.append('缺少 README 入口，仍可浏览已识别工单')
        ids = Counter(t['id'] for t in tasks)
        mapping = {t['id']: t for t in tasks}
        for task in tasks:
            if ids[task['id']] > 1:
                task['issues'].append('任务 ID 重复')
                task['completed'] = False
            task['blocked_by'] = [d for d in task['depends_on'] if d not in mapping or not mapping[d]['completed']]
            for dep in task['depends_on']:
                if dep not in mapping:
                    task['issues'].append('前置不存在：' + dep)
        # Iterative traversal keeps cyclic/very deep dependency data viewable.
        for task in tasks:
            visited, pending = set(), list(task['depends_on'])
            while pending:
                key = pending.pop()
                if key == task['id']:
                    task['issues'].append('依赖存在循环')
                    task['completed'] = False
                    break
                if key in visited or key not in mapping:
                    continue
                visited.add(key)
                pending.extend(mapping[key]['depends_on'])
        # Invalidate dependent completion to a fixed point, independent of file order.
        changed = True
        while changed:
            changed = False
            for task in tasks:
                if task['completed'] and any(dep not in mapping or not mapping[dep]['completed'] for dep in task['depends_on']):
                    task['completed'] = False
                    changed = True
        for task in tasks:
            task['blocked_by'] = [dep for dep in task['depends_on'] if dep not in mapping or not mapping[dep]['completed']]
            if task['status'] == 'completed' and task['blocked_by']:
                task['issues'].append('完成标记与前置任务不一致')
        if order:
            if len(set(order)) != len(order) or set(order) != set(ids):
                issues.append('TODO 与工单不完全匹配；未列出的工单追加显示')
            positions = {key: index for index, key in enumerate(order)}
            for task in tasks:
                if any(dep in positions and positions.get(dep, 0) >= positions.get(task['id'], len(order)) for dep in task['depends_on']):
                    task['issues'].append('TODO 顺序越过前置')
            tasks.sort(key=lambda t: (positions.get(t['id'], len(order)), t['path']))
        done = sum(t['done'] for t in tasks)
        total = sum(t['total'] for t in tasks)
        return {'name': group, 'entry': entry.relative_to(self.root(project)).as_posix() if entry else None,
                'tasks': tasks, 'issues': issues, 'summary': {'done': done, 'total': total,
                'percent': round(done / total * 100, 1) if total else None,
                'completed': sum(t['completed'] for t in tasks), 'count': len(tasks),
                'doing': sum(t['status'] == 'doing' for t in tasks),
                'blocked': sum(t['status'] == 'blocked' or bool(t['blocked_by']) for t in tasks),
                'unknown': sum(t['status'] == 'unknown' for t in tasks)}}

    def resolve(self, project, base, href):
        href = href.strip()
        if re.match(r'^[a-zA-Z]:[\\/]', href):
            target, anchor = href, ''
        else:
            parsed = urlsplit(href)
            if parsed.scheme in {'https', 'http'}:
                return {'kind': 'external', 'url': href}
            if parsed.scheme or parsed.netloc:
                raise PermissionError('不支持此链接类型')
            target = unquote(parsed.path)
            anchor = unquote(parsed.fragment)
            if not target:
                target = base
            elif not Path(target).is_absolute():
                target = str(Path(base).parent / target)
        file = self.path(project, target)
        if not file.is_file():
            raise FileNotFoundError('链接文件不存在')
        return {'kind': 'html' if file.suffix.lower() in {'.html', '.htm'} else 'document',
                'path': file.relative_to(self.root(project)).as_posix(), 'anchor': anchor}

    def document(self, project, relative):
        path = self.path(project, relative)
        if path.suffix.lower() not in TEXT:
            raise ValueError('不支持此文件类型')
        raw = self.text(path)
        meta, body = {}, raw
        warning = None
        if path.suffix.lower() == '.md':
            try:
                meta, body = self.meta(raw)
            except (yaml.YAMLError, ValueError) as error:
                warning = str(error).splitlines()[0]
        return {'path': path.relative_to(self.root(project)).as_posix(), 'text': body, 'meta': json_safe(meta),
                'kind': 'markdown' if path.suffix.lower() == '.md' else ('html' if path.suffix.lower() in {'.html', '.htm'} else 'code'),
                'warning': warning}
