"""Migrate documentation-only legacy API declarations. Default dry-run; --apply is transactional.
Only an explicit docs root is accepted. Never targets production code/SDK caches.
"""
import argparse
import ast
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, quote
import yaml
from api_markdown import LEGACY_NAME, FENCES, code_issues, validate_api
from documentation_tool import yaml_meta, valid_updated, slug

LANGUAGES = {'cs': 'cs', 'd.ts': 'ts', 'pyi': 'py'}
HEADER = re.compile(r'^\s*(?://|#)\s*(System|Side|Language|Namespace/Module|Source|CodeRevision|Status|Updated|Verification|Version):\s*(.*?)\s*$')

def brief_comment(text):
    """Keep a bounded purpose hint; full original contracts always move to responsibilities."""
    text = re.sub(r'<[^>]*>', '', text)
    text = re.sub(r'(?m)^\s*(?://+|/\*+|\*+/|\*|#)\s*', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return re.split(r'(?<=[。.!！?？])\s*|\n', text, maxsplit=1)[0][:160]

def split_legacy(text, language):
    headers, remaining = {}, []
    for line in text.splitlines():
        match = HEADER.match(line)
        if match:
            if match[1] in headers:
                raise ValueError('duplicate legacy header: ' + match[1])
            headers[match[1]] = match[2]
        else:
            remaining.append(line)
    code = '\n'.join(remaining)
    notes = []
    if language == 'py':
        tree = ast.parse(code)
        lines = code.splitlines()
        spans = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                notes.append(node.value.value)
                spans.append((node.lineno, node.end_lineno, node.value.value))
        for start, end, docstring in spans:
            original = '\n'.join(lines[start-1:end])
            states = re.findall(r'拟定|已实现|\bplanned\b|\bimplemented\b', original)
            for index in range(start-1, end):
                lines[index] = ''
            indent = re.match(r'\s*', code.splitlines()[start-1])[0]
            lines[start-1] = indent + repr(brief_comment(docstring))
            if states:
                # Docstring follows the Python signature; move the marker immediately above it.
                function = next((n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.body and n.body[0].lineno == start), None)
                if function:
                    line_index = function.lineno - 1
                    lines[line_index] = indent + '# ' + '/'.join(dict.fromkeys(states)) + '\n' + lines[line_index]
        code = '\n'.join(lines)
        # Pure documentation comments move to responsibilities, never discarded.
        notes.extend(line.lstrip()[1:].strip() for line in code.splitlines() if line.lstrip().startswith('#'))
        code = '\n'.join(line for line in code.splitlines() if not line.lstrip().startswith('#') or re.search(r'拟定|已实现|\bplanned\b|\bimplemented\b', line))
    else:
        def take(match):
            notes.append(match[0])
            states = re.findall(r'拟定|已实现|\bplanned\b|\bimplemented\b', match[0])
            purpose = brief_comment(match[0])
            marker = '/'.join(dict.fromkeys(states))
            return '// ' + (marker + ' ' if marker else '') + purpose + '\n'
        # Reject strings with comment delimiters rather than guess at language parsing.
        if any('//' in token or '/*' in token for token in re.findall(r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`''', code)):
            raise ValueError('comment delimiters in strings require manual migration')
        code = re.sub(r'/\*.*?\*/|//[^\n]*(?:\n[ \t]*//[^\n]*)*', take, code, flags=re.S)
    errors = code_issues(code, language)
    if errors:
        raise ValueError('unsafe declaration: ' + repr(errors))
    return headers, code.strip(), '\n\n'.join(notes).strip()

def relative(source, target):
    return Path(os.path.relpath(target, source.parent)).as_posix()

def rewrite_refs(text, file, mapping):
    def replace(match):
        ref = match[0]
        decoded = unquote(ref)
        name, sep, anchor = decoded.partition('#')
        if re.match(r'^[a-zA-Z]+:', name):
            return ref
        target = (file.parent / name).resolve()
        if target not in mapping:
            return ref
        new = relative(file, mapping[target]) + (sep + anchor if sep else '')
        return quote(new, safe='/#:.<>-_') if '%' in ref else new
    # Bounded filename tokens cover Markdown destinations, Mermaid clicks, YAML links and source maps.
    return re.sub(r'[^\s\[\]()<>\"\'`]+', replace, text)

def plan(root):
    if root.is_symlink():
        raise ValueError('symlink documentation root is not supported')
    root = root.resolve()
    if not root.is_dir() or root.name not in {'docs', '文档'}:
        raise ValueError('explicit documentation root named docs or 文档 required')
    if root.is_symlink():
        raise ValueError('symlink documentation root is not supported')
    files = sorted(p for p in root.rglob('*') if p.is_file() and '.git' not in p.parts)
    if any(p.is_symlink() or not p.resolve().is_relative_to(root) for p in files):
        raise ValueError('symlink/outside-root file found')
    legacy = [p for p in files if 'api' in p.relative_to(root).parts and LEGACY_NAME.fullmatch(p.name)]
    reference_formats = {'.md', '.markdown', '.yaml', '.yml', '.json', '.mmd', '.html'}
    texts = {p: p.read_text(encoding='utf-8-sig') for p in files if p.suffix.lower() in reference_formats}
    changes, mapping = {}, {}
    for old in legacy:
        relative_parts = old.relative_to(root).parts
        documented = (root.name == '文档' or '文档' in relative_parts)
        if not documented or any(part.lower() in {'sdk', 'cache', 'generated', 'node_modules'} for part in relative_parts):
            raise ValueError('only modular 文档 API may be migrated; SDK/cache/source excluded: ' + str(old))
        match = LEGACY_NAME.fullmatch(old.name)
        language = LANGUAGES[match[2]]
        new = old.with_name(match[1] + '.' + language + '.api.md')
        if new.exists() or new in mapping.values():
            raise ValueError('target conflict (never overwritten): ' + str(new))
        headers, code, notes = split_legacy(old.read_text(encoding='utf-8-sig'), language)
        owners = []
        for file, text in texts.items():
            if '职责' not in file.relative_to(root).parts:
                continue
            refs = re.findall(r'\]\(([^)]+)\)', text)
            if any((file.parent / unquote(ref.strip('<>').split('#')[0])).resolve() == old.resolve() for ref in refs):
                owners.append(file)
        if len(owners) != 1:
            raise ValueError('expected exactly one linked responsibility owner: ' + str(old))
        owner = owners[0]
        section = 'API 迁移契约 ' + match[1] + ' ' + language
        current = changes.get(owner, texts[owner])
        if re.search(r'^## ' + re.escape(section) + r'\s*$', current, re.M):
            raise ValueError('responsibility section conflict: ' + str(owner))
        # Keep every original comment/docstring, including long workflow and ownership details.
        # A later editorial pass may reorganize these without changing facts.
        changes[owner] = current.rstrip() + '\n\n## ' + section + '\n\n' + (notes or '原声明无补充契约注释。') + '\n'
        headers['Responsibility'] = relative(new, owner) + '#' + slug(section)
        state = headers.get('Status', '')
        label = '状态：' + state + '（mixed 时逐函数状态见职责契约，不把提案当已实现）。' if state == 'mixed' else '用途与关键约束见职责章节；以下为公开签名。'
        api = '---\n' + yaml.safe_dump(headers, allow_unicode=True, sort_keys=False).rstrip() + '\n---\n# ' + match[1] + ' API\n\n' + label + '\n\n[职责契约](<' + headers['Responsibility'] + '>)\n\n```' + FENCES[language] + '\n' + code + '\n```\n'
        issues = []
        def fail(file, rule, message, line=1):
            issues.append(rule + ': ' + message)
        def link(file, ref, line=1):
            ref = unquote(ref.strip('<>'))
            name, _, anchor = ref.partition('#')
            target = (file.parent / name).resolve()
            target_text = changes.get(target, texts.get(target))
            if target_text is None or anchor not in {slug(h) for h in re.findall(r'^#{1,6}\s+(.+)$', target_text, re.M)}:
                issues.append('missing responsibility heading: ' + ref)
        validate_api(new, api, fail, yaml_meta, valid_updated, link)
        if issues:
            raise ValueError('invalid converted API ' + str(old) + ': ' + '; '.join(issues))
        changes[new] = api
        mapping[old.resolve()] = new
    for file, text in {**texts, **changes}.items():
        rewritten = rewrite_refs(text, file, mapping)
        if rewritten != texts.get(file):
            changes[file] = rewritten
    # Refuse unresolved old filenames, including uncommon reference syntax, before deleting anything.
    for file, text in {**texts, **changes}.items():
        for old in legacy:
            if old.name in text or quote(old.name) in text:
                raise ValueError('unresolved legacy reference requires manual repair: ' + str(file) + ': ' + old.name)
    return changes, legacy

def apply_transaction(changes, deletions):
    """Snapshot all touched bytes; restore both created/updated/deleted files on any failure."""
    paths = set(changes) | set(deletions)
    snapshots = {p: p.read_bytes() if p.exists() else None for p in paths}
    try:
        for p, text in changes.items():
            p.write_text(text, encoding='utf-8')
        for p in deletions:
            p.unlink()
    except BaseException:
        for p, data in snapshots.items():
            if data is None:
                if p.exists():
                    p.unlink()
            else:
                p.write_bytes(data)
        raise

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('docs_root', help='explicit isolated docs or 文档 root; never a production source directory')
    parser.add_argument('--apply', action='store_true', help='write conversions, repair references, then delete legacy declarations; default is dry-run')
    args = parser.parse_args(argv)
    try:
        changes, deletions = plan(Path(args.docs_root))
        if args.apply:
            apply_transaction(changes, deletions)
        print(json.dumps({'ok': True, 'dry_run': not args.apply, 'writes': [str(p) for p in changes], 'deletes': [str(p) for p in deletions], 'limits': ['conservative syntax checks, not compiler/visibility verification', 'legacy comments preserved verbatim in responsibility sections; editorial review required', 'in-process rollback, not crash/power-loss recovery']}, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}, ensure_ascii=False))
        return 2

if __name__ == '__main__':
    raise SystemExit(main())
