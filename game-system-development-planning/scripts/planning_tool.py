"""game-system-development-planning 的只读专用工具；不自动修改产物、不承担业务语义验证。"""
import argparse
import datetime as dt
import json
import re
import sys
from collections import deque
from pathlib import Path
from urllib.parse import unquote
SCHEMAS = {'skill': ['name', 'description'], 'planning': ['id', 'kind', 'system', 'title', 'status', 'updated', 'sources', 'links', 'code_revision']}
SIDES = {'client', 'server', 'shared'}
def output(value):
    print(json.dumps(value, ensure_ascii=False, indent=2, default=str))

def yaml_meta(text):
    import yaml

    class UniqueLoader(yaml.SafeLoader):
        pass

    def mapping(loader, node, deep=False):
        result = {}
        for key_node, value_node in node.value:
            key = loader.construct_object(key_node, deep=deep)
            if key in result:
                raise ValueError('duplicate YAML key: ' + str(key))
            result[key] = loader.construct_object(value_node, deep=deep)
        return result
    UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
    match = re.match('\\A---\\r?\\n(.*?)\\r?\\n---(?:\\r?\\n|$)', text, re.S)
    if not match:
        raise ValueError('missing YAML frontmatter')
    data = yaml.load(match[1], Loader=UniqueLoader)
    if not isinstance(data, dict):
        raise ValueError('meta must be a mapping')
    return (data, text[match.end():], match.end())

def slug(title):
    title = re.sub('[^\\w\\s-]', '', title.lower(), flags=re.UNICODE)
    return title.replace(' ', '-')

def valid_updated(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}', value):
        return False
    try:
        dt.datetime.strptime(value, '%Y-%m-%d %H:%M:%S %z')
        return True
    except ValueError:
        return False

def check(args):
    path = Path(args.path).resolve()
    if not path.exists():
        raise ValueError('target does not exist')
    candidates = [path] if path.is_file() else sorted(path.rglob('*'))
    issues, count, skipped = ([], 0, [])

    def fail(file, code, message, line=1):
        issues.append({'file': str(file), 'line': line, 'rule': code, 'message': message})

    def link(file, ref, line=1):
        if ref.startswith(('https://', 'http://', 'mailto:')):
            return
        ref = unquote(ref.strip('<>'))
        target_name, _, anchor = ref.partition('#')
        target = file.parent / target_name if target_name else file
        if not target.exists():
            fail(file, 'LINK', 'missing target: ' + ref, line)
            return
        if anchor and target.suffix.lower() == '.md':
            headers = re.findall('^#{1,6}\\s+(.+)$', target.read_text(encoding='utf-8-sig'), re.M)
            if anchor not in {slug(h) for h in headers}:
                fail(file, 'ANCHOR', 'missing Markdown heading: ' + ref, line)
    for file in candidates:
        if not file.is_file() or '.git' in file.parts:
            continue
        if 'templates' in file.parts:
            skipped.append(str(file))
            continue
        in_api = 'api' in file.parts and 'references' not in file.parts
        if in_api and file.suffix.lower() in {'.md', '.json', '.yaml', '.yml'}:
            fail(file, 'API_DIRECTORY', 'API directory contains a non-declaration file')
            continue
        if in_api and re.search('\\.api\\.(cs|d\\.ts|pyi)$', file.name):
            count += 1
            text = file.read_text(encoding='utf-8-sig')
            relative = file.parts[file.parts.index('api') + 1:]
            if len(relative) < 3 or relative[0] not in SIDES:
                fail(file, 'API_SIDE', 'expected api/client|server|shared/module/file')
            for field in ['System', 'Side', 'Language', 'Source', 'CodeRevision', 'Status', 'Updated', 'Verification']:
                if not re.search('(?m)^\\s*(?://|#)\\s*' + field + ':\\s*\\S', text):
                    fail(file, 'API_HEADER', 'missing header: ' + field)
            updated_header = re.search(r'(?m)^\s*(?://|#)\s*Updated:\s*(.+)$', text)
            if updated_header and not valid_updated(updated_header[1].strip()):
                fail(file, 'API_UPDATED_TIME', 'Updated requires YYYY-MM-DD HH:mm:ss +/-HH:MM')
            side = re.search('(?m)^\\s*(?://|#)\\s*Side:\\s*(\\w+)', text)
            if side and relative and (side[1] != relative[0]):
                fail(file, 'API_SIDE', 'header Side differs from directory')
            status = re.search('(?m)^\\s*(?://|#)\\s*Status:\\s*(\\w+)', text)
            if status and status[1] not in {'planned', 'mixed', 'implemented'}:
                fail(file, 'API_STATUS', 'invalid declaration status')
            if status and '文档' in file.parts and (status[1] != 'implemented'):
                fail(file, 'API_HANDOFF', 'unfinished declaration placed in formal docs')
            if file.suffix == '.cs':
                code = re.sub('(?m)^\\s*//.*$', '', text)
                if re.search('\\bpublic\\s+(?:static\\s+|readonly\\s+)*[\\w<>\\[\\]?]+\\s+\\w+\\s*(?:;|=|\\{\\s*(?:get|set))', code):
                    fail(file, 'API_MEMBER', 'field/property found in public-function declaration')
                if re.search('\\bpublic\\s+[^;{}\\n]+\\([^;{}]*\\)\\s*\\{', code):
                    fail(file, 'API_BODY', 'implementation body found')
            continue
        if file.suffix.lower() != '.md':
            continue
        count += 1
        text = file.read_text(encoding='utf-8-sig')
        try:
            meta, body, offset = yaml_meta(text)
        except Exception as exc:
            fail(file, 'META', str(exc))
            continue
        kind = args.kind
        if file.name == 'SKILL.md' or ('name' in meta and 'description' in meta):
            kind = 'skill'
        elif kind == 'auto':
            kind = 'planning'
        for field in SCHEMAS[kind]:
            if field not in meta:
                fail(file, 'REQUIRED', 'missing meta field: ' + field)
        string_fields = {'name', 'description'} if kind == 'skill' else {'system', 'code_revision'}
        if kind == 'planning':
            string_fields |= {'id', 'title', 'kind', 'status'}
        for field in string_fields & meta.keys():
            if not isinstance(meta[field], str) or not meta[field].strip():
                fail(file, 'TYPE', field + ' must be a nonempty string')
        if kind != 'skill':
            if not valid_updated(meta.get('updated')):
                fail(file, 'UPDATED_TIME', 'updated must be a quoted YYYY-MM-DD HH:mm:ss +/-HH:MM string with a real date/time and UTC offset')
            sources = meta.get('sources')
            if not isinstance(sources, list) or any((not isinstance(s, str) or not s for s in sources)):
                fail(file, 'SOURCES', 'sources must be a list of nonempty relative paths')
            else:
                for source in sources:
                    if re.match('^(?:[A-Za-z]:|/|\\\\)', source):
                        fail(file, 'SOURCE_PATH', 'source path must be relative: ' + source)
                    elif args.project_root:
                        base = Path(args.project_root).resolve()
                        resolved = (base / source).resolve()
                        if not resolved.is_relative_to(base) or not resolved.exists():
                            fail(file, 'SOURCE_PATH', 'missing/outside project source: ' + source)
        if kind == 'planning':
            if meta.get('kind') not in {'index', 'plan', 'system'}:
                fail(file, 'KIND', 'invalid planning kind')
            if meta.get('status') not in {'draft', 'ready', 'implemented', 'superseded', 'cancelled', 'partial'}:
                fail(file, 'STATUS', 'invalid planning status')
            refs = meta.get('links', [])
            if not isinstance(refs, list):
                fail(file, 'LINKS', 'links must be a list')
            else:
                for ref in refs:
                    if isinstance(ref, str):
                        link(file, ref)
                    else:
                        fail(file, 'LINKS', 'link must be a string')
            if file.name == 'config.md':
                section = re.search('(?m)^##\\s+(?:Excel\\s*)?字段字典\\s*\\n(.*?)(?=^##\\s|\\Z)', body, re.S | re.M)
                if not section:
                    fail(file, 'CONFIG_FIELDS', 'missing field dictionary section')
                else:
                    table = [line.strip() for line in section[1].splitlines() if line.strip().startswith('|')]
                    if len(table) < 3:
                        fail(file, 'CONFIG_FIELDS', 'field dictionary has no data rows')
                    else:
                        cells = lambda row: [c.strip() for c in re.split('(?<!\\\\)\\|', row.strip('|'))]
                        headers = cells(table[0])
                        comments = [i for i, h in enumerate(headers) if '注释' in h or 'TIPS' in h]
                        if not comments:
                            fail(file, 'CONFIG_TIPS', 'dictionary must include a field-comment/TIPS column')
                        for row in table[2:]:
                            values = cells(row)
                            if len(values) != len(headers):
                                fail(file, 'CONFIG_COLUMNS', 'field row/header column counts differ')
                            elif comments and (not values[comments[0]]):
                                fail(file, 'CONFIG_TIPS', 'field has an empty comment: ' + values[0])
                if not re.search('(?m)^##\\s+.*处理清单', body):
                    fail(file, 'CONFIG_ACTIONS', 'missing existing/missing-field processing list')
        if kind != 'skill' and 'roles' in meta:
            roles = meta['roles']
            if not isinstance(roles, list) or not roles or any(not isinstance(r, str) or r not in {'dispatcher', 'executor', 'tool', 'data'} for r in roles):
                fail(file, 'ROLES', 'roles must contain dispatcher/executor/tool/data')
        if kind != 'skill' and ('dispatcher' in meta or 'design_patterns' in meta or isinstance(meta.get('roles'), list) and 'dispatcher' in meta['roles']):
            if not isinstance(meta.get('roles'), list) or 'dispatcher' not in meta['roles']:
                fail(file, 'ROLES', 'dispatcher meta requires roles: [dispatcher]')
            if not isinstance(meta.get('dispatcher'), str) or not meta['dispatcher'].strip():
                fail(file, 'DISPATCHER', 'dispatcher must name the actual/proposed type')
            patterns = meta.get('design_patterns')
            if not isinstance(patterns, list) or not patterns:
                fail(file, 'DESIGN_PATTERNS', 'dispatcher requires nonempty design_patterns')
            elif any(not isinstance(p, dict) or not isinstance(p.get('name'), str) or not p['name'].strip() or not isinstance(p.get('uses'), str) or not p['uses'].strip() for p in patterns):
                fail(file, 'DESIGN_PATTERNS', 'each pattern requires nonempty name and uses')
            section = re.search(r'^## 调度流水线\s*\n(.*?)(?=^## |\Z)', body, re.S | re.M)
            pipelines = re.findall(r'^### ([^\n]+)\n(.*?)(?=^### |\Z)', section[1], re.S | re.M) if section else []
            if not pipelines:
                fail(file, 'DISPATCH_PIPELINES', 'dispatcher requires named pipelines under ## 调度流水线')
            for title, content in pipelines:
                if not re.search(r'```mermaid\s*\n(?:(?!```)[\s\S])*?\bflowchart\s+(?:TD|TB|LR|RL|BT)\b', content):
                    fail(file, 'DISPATCH_FLOW', 'pipeline lacks flowchart: ' + title)
            refs = meta.get('links', []) if kind == 'planning' else [d.get('document', '') for d in meta.get('dependencies', []) if isinstance(d, dict)]
            for ref in refs if isinstance(refs, list) else []:
                if not isinstance(ref, str):
                    continue
                target = (file.parent / ref.split('#')[0]).resolve()
                if target == file.resolve() or not target.is_file():
                    continue
                try:
                    other, _, _ = yaml_meta(target.read_text(encoding='utf-8-sig'))
                except Exception:
                    continue
                if other.get('dispatcher') and other.get('dispatcher') != meta.get('dispatcher'):
                    clicks = re.findall(r'click\s+\w+\s+"([^"\n]+)"', section[1] if section else '')
                    if not any((file.parent / c.split('#')[0]).resolve() == target for c in clicks):
                        fail(file, 'DISPATCH_LINK', 'cross-dispatcher dependency needs clickable pipeline node: ' + ref)
        for match in re.finditer('\\]\\(([^)]+)\\)', body):
            link(file, match[1], text[:offset + match.start()].count('\n') + 1)
        for graph in re.findall('```mermaid\\s*\\n(.*?)\\n```', body, re.S):
            nodes = dict(re.findall('(\\w+)\\["([^"]+)"\\]', graph))
            for node, ref in re.findall('click\\s+(\\w+)\\s+"([^"]+)"', graph):
                link(file, ref)
                target = file.parent / ref.split('#')[0]
                if node not in nodes:
                    fail(file, 'GRAPH_NODE', 'linked node is not declared: ' + node)
                elif target.exists() and target.suffix == '.md':
                    label = nodes[node].split('<br/>')[0]
                    titles = re.findall('^#{1,6}\\s+(.+)$', target.read_text(encoding='utf-8-sig'), re.M)
                    if label not in titles:
                        fail(file, 'GRAPH_NAME', 'node/document title mismatch: ' + label)
    if count == 0 and (not issues):
        fail(path, 'EMPTY_SCOPE', 'no supported document/declaration files checked')
    output({'ok': not issues, 'checked_files': count, 'issues': issues, 'skipped_template_count': len(skipped), 'limits': ['no business/ownership verification', 'no Mermaid rendering or language API semantic parsing', 'remote URLs not fetched'] + ([] if args.project_root else ['source existence not checked without --project-root'])})
    return 0 if not issues else 1

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 sub=parser.add_subparsers(dest='command',required=True)
 sub.add_parser('rules')
 check_parser=sub.add_parser('check')
 check_parser.add_argument('path')
 check_parser.add_argument('--project-root')

 args=parser.parse_args()
 args.kind='planning'
 try:
  if args.command=='rules':
   output({'kind':args.kind,'required_meta':SCHEMAS[args.kind],'read_only':True,'optional_dispatcher_meta':['roles','dispatcher','design_patterns']})
   return 0
  if args.command=='check':return check(args)
  raise ValueError('unsupported command')
 except Exception as exc:
  output({'ok':False,'error':str(exc),'exception':type(exc).__name__})
  return 2
if __name__=='__main__':
 raise SystemExit(main())
