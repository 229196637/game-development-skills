"""Shared, read-only API Markdown rules. Not a complete language/visibility parser."""
import ast
import re
from pathlib import Path
from urllib.parse import unquote

API_NAME = re.compile(r'^(.+)\.(cs|ts|py)\.api\.md$')
LEGACY_NAME = re.compile(r'^(.+)\.api\.(cs|d\.ts|pyi)$')
FENCES = {'cs': 'csharp', 'ts': 'typescript', 'py': 'python'}
FIELDS = ('System', 'Side', 'Language', 'Source', 'CodeRevision', 'Status', 'Updated', 'Verification', 'Responsibility')

def is_api_ref(ref):
    path = Path(unquote(ref.strip('<>').split('#')[0]))
    return 'api' in path.parts and bool(API_NAME.fullmatch(path.name))

def code_issues(code, language):
    """Conservative structural checks; never claims compiler-level coverage."""
    errors = []
    if language == 'py':
        try:
            tree = ast.parse(code)
        except SyntaxError as exc:
            return [('API_SYNTAX', str(exc))]
        def visit(nodes, context='module'):
            for node in nodes:
                if isinstance(node, (ast.Import, ast.ImportFrom)) and context == 'module':
                    continue
                if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                    continue
                if isinstance(node, ast.ClassDef):
                    visit(node.body, 'class')
                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if node.name.startswith('_') and node.name != '__call__':
                        errors.append(('API_MEMBER', 'non-public Python function'))
                    for statement in node.body:
                        if isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Constant) and (statement.value.value is Ellipsis or isinstance(statement.value.value, str)):
                            continue
                        errors.append(('API_BODY', 'Python function must contain only optional docstring and ellipsis'))
                else:
                    errors.append(('API_MEMBER', 'only imports, type shells and public function signatures are allowed'))
        visit(tree.body)
        if not any(isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) for n in ast.walk(tree)):
            errors.append(('API_EMPTY', 'no public function declarations'))
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and any(isinstance(d, ast.Name) and d.id == 'property' or isinstance(d, ast.Attribute) and d.attr in {'setter', 'getter', 'deleter'} for d in node.decorator_list):
                errors.append(('API_MEMBER', 'Python property/accessor found'))
        return errors
    clean = re.sub(r'/\*.*?\*/|//[^\n]*', '', code, flags=re.S)
    clean = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '""', clean)
    if re.search(r'\)\s*(?:where\s+[^;{]+)?\s*(?:\{|=>)', clean) or re.search(r'\)\s*:\s*[^;{}]+\{', clean):
        errors.append(('API_BODY', 'implementation body found'))
    if '=>' in clean:
        errors.append(('API_BODY', 'expression/lambda implementation found; review callable-type signatures manually'))
    if not re.search(r'\w+(?:<[^>]+>)?\s*\(', clean):
        errors.append(('API_EMPTY', 'no identifiable public function declarations'))
    if language == 'cs':
        types = re.findall(r'\b(?:class|struct|interface|record)\s+(\w+)', clean)
        if any(re.search(r'\b' + re.escape(name) + r'\s*\(', clean) for name in types) or re.search(r'\boperator\b', clean):
            errors.append(('API_MEMBER', 'constructor/destructor/operator found'))
        if re.search(r'\b(private|protected|internal)\b|\bevent\b|\b(get|set|init)\s*(?:;|\{)', clean):
            errors.append(('API_MEMBER', 'non-public member, property or event found'))
        if re.search(r'\bpublic\s+(?:static\s+|readonly\s+|const\s+)*[\w<>\[\]?.,]+\s+\w+\s*(?:;|=)', clean):
            errors.append(('API_MEMBER', 'field found'))
    elif re.search(r'\b(private|protected|constructor|get|set)\b|^\s*(?:readonly\s+)?\w+\??\s*:\s*[^\n]+;', clean, re.M):
        errors.append(('API_MEMBER', 'non-function TypeScript member found'))
    return errors

def validate_api(file, text, fail, yaml_meta, valid_updated, link, project_root=None):
    match = API_NAME.fullmatch(file.name)
    if not match:
        fail(file, 'API_NAME', 'expected <type>.cs|ts|py.api.md')
        return
    try:
        meta, body, _ = yaml_meta(text)
    except Exception as exc:
        fail(file, 'API_META', str(exc))
        return
    extra = set(meta) - set(FIELDS) - {'Namespace/Module', 'Version'}
    if extra:
        fail(file, 'API_META', 'unexpected API fields: ' + ', '.join(sorted(map(str, extra))))
    malformed = False
    for field in FIELDS:
        if not isinstance(meta.get(field), str) or not meta[field].strip():
            fail(file, 'API_HEADER', 'missing/non-string header: ' + field)
            malformed = True
    if malformed:
        return
    expected_languages = {'cs': {'C#', 'csharp', 'cs'}, 'ts': {'TypeScript', 'JavaScript', 'TypeScript/JavaScript', 'typescript', 'ts'}, 'py': {'Python', 'python', 'py'}}
    if meta.get('Language') not in expected_languages[match[2]]:
        fail(file, 'API_LANGUAGE', 'Language differs from filename language')
    relative = file.parts[file.parts.index('api') + 1:]
    if len(relative) < 2 or relative[0] not in {'client', 'server', 'shared'} or meta.get('Side') != relative[0]:
        fail(file, 'API_SIDE', 'expected matching api/client|server|shared/ and Side')
    if not valid_updated(meta.get('Updated')):
        fail(file, 'API_UPDATED_TIME', 'Updated requires YYYY-MM-DD HH:mm:ss +/-HH:MM')
    if meta.get('Status') not in {'planned', 'mixed', 'implemented'}:
        fail(file, 'API_STATUS', 'invalid API status')
    if meta.get('Status') in {'planned', 'mixed'} and '设计' not in file.parts:
        fail(file, 'API_HANDOFF', 'unfinished API must remain in 设计/<任务>/')
    source = meta.get('Source', '')
    if isinstance(source, str):
        if re.match(r'^(?:[A-Za-z]:|/|\\)', source) or '..' in Path(source).parts:
            fail(file, 'API_SOURCE', 'Source must be project-relative')
        elif project_root and meta.get('Status') == 'implemented' and not (Path(project_root) / source).is_file():
            fail(file, 'API_SOURCE', 'missing source: ' + source)
    responsibility = meta.get('Responsibility')
    if isinstance(responsibility, str):
        target, _, anchor = responsibility.partition('#')
        if not anchor or '职责' not in Path(target).parts or Path(target).suffix != '.md':
            fail(file, 'API_RESPONSIBILITY', 'Responsibility must link a 职责/*.md heading')
        link(file, responsibility)
    blocks = re.findall(r'^```([^\n]*)\n(.*?)^```[ \t]*$', body, re.M | re.S)
    if not blocks or any(language.strip() != FENCES[match[2]] for language, _ in blocks):
        fail(file, 'API_FENCE', 'expected only ' + FENCES[match[2]] + ' signature fences')
    for _, code in blocks:
        for rule, message in code_issues(code, match[2]):
            fail(file, rule, message)
    if meta.get('Status') == 'mixed':
        # Each declaration needs a nearby state, not merely a file-level mixed notice.
        for _, code in blocks:
            pending = False
            functions = 0
            for line in code.splitlines():
                if re.search(r'拟定|已实现|\bplanned\b|\bimplemented\b', line):
                    pending = True
                if re.search(r'\w+(?:<[^>]+>)?\s*\(', line) and not line.lstrip().startswith(('//', '*', '#')):
                    functions += 1
                    if not pending:
                        fail(file, 'API_MIXED', 'mixed API must label each function planned/implemented')
                    pending = False
            if not functions:
                fail(file, 'API_MIXED', 'mixed API contains no identifiable function declarations')
    for ref in re.findall(r'\]\(([^)]+)\)', body):
        link(file, ref)
    for heading in re.findall(r'^#{1,6}\s+(.+)$', body, re.M):
        if re.search('流程|架构|生命周期|内部协作|操作步骤|测试|验收', heading):
            fail(file, 'API_SCOPE', 'move detailed usage/workflow/lifecycle content to responsibility document: ' + heading)
