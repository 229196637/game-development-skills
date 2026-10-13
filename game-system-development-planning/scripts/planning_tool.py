"""逐类执行记录工具；不执行测试、不写生产源码或系统文档。"""
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import re
import sys
import tempfile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

KEYS = ("task_id", "class", "document", "status", "depends_on", "required_tests", "required_acceptance", "updated")
STATUSES = ("todo", "doing", "blocked", "completed")
HEADER = "| 时间 | 测试 ID | 命令/步骤 | 预期 | 实际 | 结果 | 证据 |\n| --- | --- | --- | --- | --- | --- | --- |"
ACCEPTANCE_HEADER = "| 时间 | 验收 ID | 实际情况 | 结果 | 证据 |\n| --- | --- | --- | --- | --- |"
SECTIONS = ["目标", "当前情况与改动", "文档索引", "任务内容", "验收标准", "测试过程", "验收情况"]
STAMP = r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}"


def now():
    value = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z")
    return value[:-2] + ":" + value[-2:]


def require(value, message):
    if not value:
        raise ValueError(message)


def nonempty(value):
    require(value.strip(), "文本字段不能为空")
    require("\n" not in value and "\r" not in value, "单项字段不得含换行")
    return value.strip()


def location(root, relative):
    path = Path(relative)
    require(not path.is_absolute() and ".." not in path.parts and path.parts,
            "--file 必须是任务根内相对路径，不含 ..")
    require(path.suffix == ".md" and path.name.lower() != "readme.md", "任务文件必须为非 README 的 .md")
    target = (root / path).resolve()
    require(target.is_relative_to(root) and ".git" not in target.parts,
            "任务路径越界或指向 .git")
    return target


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".planning-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def section(body, title):
    match = re.search(r"^## " + re.escape(title) + r"\s*\n(.*?)(?=^## |\Z)", body, re.S | re.M)
    return match[1] if match else ""


def replace_section(body, title, content):
    pattern = r"(^## " + re.escape(title) + r"[ \t]*\n)[ \t\n]*.*?(?=^## |\Z)"
    return re.sub(pattern, lambda m: m[1] + "\n" + content.strip() + "\n\n", body, flags=re.S | re.M)


def append_row(task, title, fields):
    row = "| " + " | ".join(nonempty(x).replace("|", "&#124;") for x in fields) + " |"
    task["body"] = replace_section(task["body"], title, section(task["body"], title).rstrip() + "\n" + row)


def parse_rows(text, width, heading):
    rows = []
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = [x.strip() for x in line.strip().strip("|").split("|")]
        if cells[0] == heading or all(re.fullmatch(r"[-: ]+", x) for x in cells):
            continue
        require(len(cells) == width and all(cells), "表格字段缺失或列数错误")
        rows.append(cells)
    return rows


def reference(path, target):
    return os.path.relpath(target, path.parent).replace("\\", "/")


def directory_map(path):
    require(path and path.is_file() and path.name == "目录架构.md", "缺少独立目录架构.md")
    readme = path.parent / "README.md"
    require(readme.is_file(), "目录架构必须与文档入口 README 同级")
    refs = re.findall(r"\[[^\]]*\]\(([^)]+)\)", readme.read_text(encoding="utf-8-sig"))
    require(any((readme.parent / ref.split("#")[0]).resolve() == path.resolve() for ref in refs if not re.match(r"[a-z]+://", ref)), "文档 README 必须直接链接同级目录架构.md；先由文档技能补入口")

def specification(args, path, document):
    brief = args.brief if args.brief is not None else args.brief_file.read_text(encoding="utf-8-sig")
    require(brief.strip() and not re.search(r"^## ", brief, re.M), "请填写具体当前情况与改动，不嵌套二级标题")
    items = [nonempty(x) for x in args.item]
    criteria = []
    for raw in args.acceptance:
        identifier, separator, text = raw.partition("::")
        require(separator and re.fullmatch(r"[\w.-]+", identifier), "验收标准格式为 ID::可观察的通过条件")
        criteria.append((identifier, nonempty(text).replace("|", "&#124;")))
    require(len({x[0] for x in criteria}) == len(criteria), "验收 ID 重复")
    architecture = args.architecture.resolve() if args.architecture else next((parent / "目录架构.md" for parent in document.parents if (parent / "目录架构.md").is_file() and (parent / "README.md").is_file()), None)
    require(architecture and architecture.is_file() and architecture.name == "目录架构.md" and (architecture.parent / "README.md").is_file(), "先补目录架构.md，必须与文档入口 README.md 同级")
    directory_map(architecture)
    refs = [("对应类文档", document), ("文档入口", architecture.parent / "README.md"), ("目录架构", architecture)]
    for raw in args.reference:
        label, separator, raw_path = raw.partition("::")
        require(separator, "文档索引格式为 名称::实际路径")
        target = Path(raw_path).resolve()
        require(target.is_file(), f"索引文件不存在：{target}")
        refs.append((nonempty(label), target))
    index = "\n".join(f"- [{label}]({reference(path, target)})" for label, target in refs)
    standards = "| 验收 ID | 通过条件 |\n| --- | --- |\n" + "\n".join(f"| {key} | {value} |" for key, value in criteria)
    return brief.strip(), items, criteria, index, standards


def work_order(class_name, goal, brief, items, index, standards, tests="规划时尚未执行；后续实际结果以表内最新记录为准。\n\n" + HEADER, acceptance="规划时尚未验收；后续实际结果以表内最新记录为准。\n\n" + ACCEPTANCE_HEADER):
    contents = [goal, brief, index, "\n".join("- [ ] " + x for x in items), standards, tests, acceptance]
    return f"# {class_name}\n\n" + "\n\n".join(f"## {title}\n\n{content.strip()}" for title, content in zip(SECTIONS, contents)) + "\n"


def modern(task):
    require(not task["legacy"], "旧版空泛任务请先用 update 补具体内容、索引和验收标准")


def invalidate(task, reason):
    for key in task["meta"]["required_tests"]:
        append_row(task, "测试过程", [now(), key, reason, "重新验证当前工作", "旧通过记录不适用于本轮", "not-run", reason])
    for key in task["meta"]["required_acceptance"]:
        append_row(task, "验收情况", [now(), key, "本轮尚未验收", "not-run", reason])

def read(path):
    raw = path.read_text(encoding="utf-8-sig")
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n", raw, re.S)
    require(match, f"缺少任务 meta：{path}")
    meta = {}
    for line in match[1].splitlines():
        if not line.strip():
            continue
        key, separator, value = line.partition(":")
        require(separator and key in KEYS and key not in meta, f"未知/重复 meta 字段：{line}")
        meta[key] = json.loads(value.strip())
    legacy = set(meta) == set(KEYS) - {"required_acceptance"}
    require(legacy or set(meta) == set(KEYS), f"meta 缺字段：{path}")
    if legacy:
        meta["required_acceptance"] = []
    for key in ("task_id", "class", "document", "updated"):
        require(isinstance(meta[key], str) and meta[key].strip(), f"{key} 必须是非空字符串")
    require(re.fullmatch(r"[\w.-]+", meta["task_id"]), "task_id 只用字母数字下划线点或连字符")
    require(meta["status"] in STATUSES, "无效状态")
    require(re.fullmatch(STAMP, meta["updated"]), "updated 必须包含时分秒与时区")
    for key in ("depends_on", "required_tests", "required_acceptance"):
        values = meta[key]
        require(isinstance(values, list) and all(isinstance(x, str) and x.strip() for x in values), f"{key} 必须为字符串列表")
        require(len(values) == len(set(values)), f"{key} 不得重复")
    require(meta["required_tests"], "必须登记至少一项适当验证")
    body = raw[match.end():]
    require(re.findall(r"^## (.+)$", body, re.M) == (["目标", "任务内容", "测试过程"] if legacy else SECTIONS), "工单需要目标、具体改动、文档索引、工作项、验收标准和底部测试/验收记录")
    require(re.search(r"^# " + re.escape(meta["class"]) + r"\s*$", body, re.M), "标题与类/脚本名不一致")
    goal = section(body, "目标").strip()
    require(goal, "目标不能为空")
    items = re.findall(r"^- \[([ xX])\] (.+)$", section(body, "任务内容"), re.M)
    require(items, "任务内容必须含勾选项")
    tests = []
    for line in section(body, "测试过程").splitlines():
        if not line.startswith("|"):
            continue
        cells = [x.strip() for x in line.strip().strip("|").split("|")]
        if cells[0] == "时间" or all(re.fullmatch(r"[-: ]+", x) for x in cells):
            continue
        require(len(cells) == 7 and all(cells), "测试记录必须有七个非空字段")
        require(re.fullmatch(STAMP, cells[0]), "测试时间格式错误")
        require(cells[1] in meta["required_tests"], f"未登记测试 ID：{cells[1]}")
        require(cells[5] in ("passed", "failed", "not-run"), "测试结果无效")
        tests.append(cells)
    document = (path.parent / meta["document"]).resolve()
    require(document.is_file() and document.suffix.lower() == ".md", f"对应文档不存在：{document}")
    acceptance = []
    if not legacy:
        require(meta["required_acceptance"], "工单必须预先填写验收标准")
        require(section(body, "当前情况与改动").strip(), "当前情况与具体改动不能为空")
        criteria = parse_rows(section(body, "验收标准"), 2, "验收 ID")
        require([row[0] for row in criteria] == meta["required_acceptance"], "验收标准必须与 meta ID 一一对应")
        refs = re.findall(r"\[[^\]]+\]\(([^)]+)\)", section(body, "文档索引"))
        targets = [(path.parent / ref.split("#")[0]).resolve() for ref in refs]
        require(document in targets and len(targets) >= 2, "文档索引必须包含类文档和目录架构")
        for target in targets:
            require(target.is_file(), f"索引文档不存在：{target}")
        maps = [target for target in targets if target.name == "目录架构.md"]
        require(maps and all((target.parent / "README.md").is_file() for target in maps), "目录架构必须与文档 README 同级")
        for target in maps:
            directory_map(target)
        acceptance = parse_rows(section(body, "验收情况"), 5, "时间")
        for row in acceptance:
            require(re.fullmatch(STAMP, row[0]) and row[1] in meta["required_acceptance"], "验收时间或 ID 无效")
            require(row[3] in ("passed", "failed", "not-run"), "验收结果无效")
    return {"path": path, "meta": meta, "body": body, "items": items, "tests": tests, "document": document, "acceptance": acceptance, "legacy": legacy}


def save(task):
    task["meta"]["updated"] = now()
    front = "\n".join(f"{key}: {json.dumps(task['meta'][key], ensure_ascii=False)}" for key in KEYS)
    write(task["path"], "---\n" + front + "\n---\n" + task["body"].rstrip() + "\n")


def scan(root):
    tasks = {}
    for path in sorted(root.rglob("*.md")):
        if path.name.lower() == "readme.md" or any(part.startswith(".") for part in path.relative_to(root).parts):
            continue
        require(path.resolve().is_relative_to(root), "任务文件链接越界")
        task = read(path)
        require(not task["document"].is_relative_to(root), "对应文档必须位于执行任务根之外，只引用不复制")
        identifier = task["meta"]["task_id"]
        require(identifier not in tasks, f"重复任务 ID：{identifier}")
        tasks[identifier] = task
    for identifier, task in tasks.items():
        for dependency in task["meta"]["depends_on"]:
            require(dependency in tasks, f"{identifier} 的前置不存在：{dependency}")
    pending = dict(tasks)
    order = []
    while pending:
        ready = [key for key, task in pending.items() if all(x in order for x in task["meta"]["depends_on"])]
        require(ready, "任务前置存在循环")
        for key in ready:
            order.append(key)
            del pending[key]
    return tasks, order


def predecessors(task, tasks):
    for key in task["meta"]["depends_on"]:
        require(tasks[key]["meta"]["status"] == "completed", f"前置任务尚未完成：{key}")


def completion(task, tasks):
    modern(task)
    predecessors(task, tasks)
    require(all(x.lower() == "x" for x, _ in task["items"]), "任务内容尚未全部勾选")
    latest = {cells[1]: cells[5] for cells in task["tests"]}
    for key in task["meta"]["required_tests"]:
        require(latest.get(key) == "passed", f"必需测试最近记录未通过：{key}")
    latest_acceptance = {row[1]: row[3] for row in task["acceptance"]}
    for key in task["meta"]["required_acceptance"]:
        require(latest_acceptance.get(key) == "passed", f"验收最近记录未通过：{key}")


def directories(root, path):
    # 摘要只更新明确工具拥有的导航区，保留用户编写的执行顺序和文档链接。
    start, end = "<!-- planning-tool:begin -->", "<!-- planning-tool:end -->"
    directory = path.parent
    while directory.is_relative_to(root):
        readme = directory / "README.md"
        require(readme.resolve().is_relative_to(root), "README 链接越界")
        text = readme.read_text(encoding="utf-8") if readme.exists() else f"# {directory.name}\n\n本目录保存逐类执行任务。按任务入口的依赖顺序读取；状态以各类 MD 为准。\n"
        links = []
        for child in sorted(directory.iterdir()):
            if child.name.startswith(".") or child.name.lower() == "readme.md":
                continue
            if child.is_dir() and (child / "README.md").is_file():
                links.append(f"- [{child.name}]({child.name}/README.md)")
            elif child.suffix == ".md":
                links.append(f"- [{child.stem}]({child.name})")
        block = start + "\n\n" + "\n".join(links) + "\n\n" + end
        if start in text:
            require(end in text, "README 工具导航标记不完整")
            text = re.sub(re.escape(start) + r".*?" + re.escape(end), lambda _: block, text, flags=re.S)
        else:
            text += "\n\n" + block + "\n"
        write(readme, text)
        if directory == root:
            break
        directory = directory.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("rules")
    for name in ("init", "update", "check", "list", "status", "set-item", "record-test", "record-acceptance", "complete"):
        command = sub.add_parser(name)
        command.add_argument("--root", required=True, type=Path)
        if name in ("check", "list"):
            continue
        command.add_argument("--file", required=True)
        if name in ("init", "update"):
            brief_group = command.add_mutually_exclusive_group(required=True)
            brief_group.add_argument("--brief")
            brief_group.add_argument("--brief-file", type=Path)
            command.add_argument("--acceptance", action="append", required=True)
            command.add_argument("--architecture", type=Path)
            command.add_argument("--reference", action="append", default=[])
            command.add_argument("--item", action="append", required=True)
            command.add_argument("--goal", required=name == "init")
        if name == "init":
            command.add_argument("--id", required=True)
            command.add_argument("--class", dest="class_name", required=True)
            command.add_argument("--document", required=True, type=Path)
            command.add_argument("--required-test", action="append", required=True)
            command.add_argument("--depends-on", action="append", default=[])
        elif name == "status":
            command.add_argument("--value", choices=("todo", "doing", "blocked"), required=True)
        elif name == "set-item":
            command.add_argument("--number", type=int, required=True)
            command.add_argument("--value", choices=("done", "pending"), required=True)
        elif name == "record-acceptance":
            command.add_argument("--acceptance-id", required=True)
            command.add_argument("--actual", required=True)
            command.add_argument("--evidence", required=True)
            command.add_argument("--result", choices=("passed", "failed", "not-run"), required=True)
        elif name == "record-test":
            for field in ("test-id", "command", "expected", "actual", "evidence"):
                command.add_argument("--" + field, required=True)
            command.add_argument("--result", choices=("passed", "failed", "not-run"), required=True)
    args = parser.parse_args()
    if args.action == "rules":
        return {"order": "先文档后规划", "owner": "逐类工单", "meta": KEYS,
                "completion": "前置完成、工作项勾选、每项必需测试与验收最近 passed；不证明真实测试执行"}
    root = args.root.resolve()
    require(".git" not in root.parts, "任务根不能是 .git")
    if args.action == "init":
        path = location(root, args.file)
        require(not path.exists(), "拒绝覆盖已有任务")
        document = args.document.resolve()
        require(document.is_file() and document.suffix.lower() == ".md", "对应文档必须已存在")
        require(not document.is_relative_to(root), "对应文档必须在执行任务根之外")
        identifier = nonempty(args.id)
        require(re.fullmatch(r"[\w.-]+", identifier), "task_id 格式错误")
        tasks, _ = scan(root)
        require(identifier not in tasks, "任务 ID 已存在")
        require(len(args.depends_on) == len(set(args.depends_on)), "前置 ID 重复")
        for dependency in args.depends_on:
            require(dependency in tasks, f"请先登记前置任务：{dependency}")
        class_name = nonempty(args.class_name)
        require(path.stem == class_name, "文件名必须与类/脚本名一致")
        tests = [nonempty(x) for x in args.required_test]
        require(len(tests) == len(set(tests)) and all("|" not in x for x in tests), "测试 ID 重复或含 |")
        goal = nonempty(args.goal)
        items = [nonempty(x) for x in args.item]
        reference = os.path.relpath(document, path.parent).replace("\\", "/")
        brief, items, criteria, index, standards = specification(args, path, document)
        meta = dict(zip(KEYS, (identifier, class_name, reference, "todo", args.depends_on, tests, [x[0] for x in criteria], now())))
        body = work_order(class_name, goal, brief, items, index, standards)
        save({"path": path, "meta": meta, "body": body})
        directories(root, path)
        return {"created": str(path), "status": "todo"}
    tasks, order = scan(root)
    if args.action in ("check", "list"):
        if args.action == "check":
            for task in tasks.values():
                modern(task)
                if task["meta"]["status"] == "completed":
                    completion(task, tasks)
            require(tasks, "没有逐类任务")
            for directory in {root} | {parent for task in tasks.values() for parent in task["path"].parents if parent.is_relative_to(root)}:
                require((directory / "README.md").is_file(), f"缺少目录 README：{directory}")
        return {"tasks": [{"id": key, "class": tasks[key]["meta"]["class"], "status": tasks[key]["meta"]["status"], "file": str(tasks[key]["path"]), "depends_on": tasks[key]["meta"]["depends_on"]} for key in order]}
    path = location(root, args.file)
    task = next((task for task in tasks.values() if task["path"] == path), None)
    require(task, "任务文件不存在或未纳入任务根")
    if args.action == "update":
        brief, items, criteria, index, standards = specification(args, path, task["document"])
        task["body"] = work_order(task["meta"]["class"], args.goal or section(task["body"], "目标").strip(), brief, items, index, standards, section(task["body"], "测试过程") or HEADER, section(task["body"], "验收情况") or ACCEPTANCE_HEADER)
        task["meta"]["required_acceptance"] = [x[0] for x in criteria]
        # 修改验收标准时保留旧标准 ID 为历史，否则旧验收记录将失去对应关系。
        for row in task["acceptance"]:
            require(row[1] in task["meta"]["required_acceptance"], "已有验收 ID 不可删除；保留 ID 并修订通过条件")
        task["meta"]["status"] = "todo"
        task["legacy"] = False
        invalidate(task, "工单内容更新，重新执行与验收")
        save(task)
        return {"file": str(path), "status": "todo", "action": "update"}
    modern(task)
    if args.action == "status":
        if args.value == "doing":
            predecessors(task, tasks)
        if task["meta"]["status"] == "completed":
            invalidate(task, "任务重开")
        task["meta"]["status"] = args.value
    elif args.action == "complete":
        completion(task, tasks)
        task["meta"]["status"] = "completed"
    elif args.action == "set-item":
        require(task["meta"]["status"] != "completed", "已完成工单先重开")
        require(1 <= args.number <= len(task["items"]), "工作项序号越界")
        entries = task["items"][:]
        entries[args.number - 1] = ("x" if args.value == "done" else " ", entries[args.number - 1][1])
        content = "\n".join(f"- [{mark}] {text}" for mark, text in entries)
        task["body"] = replace_section(task["body"], "任务内容", content)
        if args.value == "pending":
            invalidate(task, "工作项退回未完成，需重新记录测试与验收")
    elif args.action == "record-acceptance":
        require(task["meta"]["status"] != "completed", "已完成工单先重开")
        require(args.acceptance_id in task["meta"]["required_acceptance"], "验收 ID 未登记")
        append_row(task, "验收情况", [now(), args.acceptance_id, args.actual, args.result, args.evidence])
    elif args.action == "record-test":
        require(task["meta"]["status"] != "completed", "已完成任务请先退回 doing")
        require(args.test_id in task["meta"]["required_tests"], "测试 ID 未登记")
        fields = [now(), args.test_id, args.command, args.expected, args.actual, args.result, args.evidence]
        # 表格内 | 用 HTML 实体，避免改变列数；工具不执行这些文字。
        fields = [nonempty(x).replace("|", "&#124;") for x in fields]
        append_row(task, "测试过程", fields)
    save(task)
    return {"file": str(path), "status": task["meta"]["status"], "action": args.action}


if __name__ == "__main__":
    try:
        print(json.dumps({"ok": True, "result": main()}, ensure_ascii=False, indent=2))
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False, indent=2))
        sys.exit(1)
