"""共享工单格式与约束；供规划编写和执行记录复用，不包含命令入口。"""
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


def mirrored_file(document):
    require("文档" in document.parts, "对应类文档必须位于 docs/文档 树内")
    prefix = document.parts.index("文档")
    relative = Path(*document.parts[prefix + 1:])
    require(len(relative.parts) >= 3 and "职责" in relative.parts[:-1], "对应文档应为 <模块>/职责/.../<类名>.md")
    require(relative.suffix == ".md" and relative.name != "README.md", "必须指向具体类/脚本文档")
    return relative


def check_mirror(root, path, document, class_name):
    expected = mirrored_file(document)
    require(path.relative_to(root) == expected, f"规划必须镜像文档层级，--file 应为 {expected.as_posix()}")
    require(path.stem == document.stem == class_name, "规划文件名、文档文件名与类/脚本名必须一致")

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


def scan(root, enforce_layout=True):
    tasks = {}
    for path in sorted(root.rglob("*.md")):
        if path.name.lower() == "readme.md" or any(part.startswith(".") for part in path.relative_to(root).parts):
            continue
        require(path.resolve().is_relative_to(root), "任务文件链接越界")
        task = read(path)
        require(not task["document"].is_relative_to(root), "对应文档必须位于执行任务根之外，只引用不复制")
        if enforce_layout:
            check_mirror(root, path, task["document"], task["meta"]["class"])
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


def todo_order(root):
    tasks, fallback = scan(root)
    readme = root / "README.md"
    require(readme.is_file(), "任务入口缺少 README.md")
    text = readme.read_text(encoding="utf-8-sig")
    match = re.search(r"<!-- planning-todo:begin -->(.*?)<!-- planning-todo:end -->", text, re.S)
    require(match, "入口缺少结构化 TODO；先用规划工具 order 生成")
    rows = parse_rows(match[1], 3, "顺序")
    order = [row[1] for row in rows]
    require(len(order) == len(set(order)) and set(order) == set(tasks), "TODO 必须完整且每项恰好一次；重新规划 order")
    for number, row in enumerate(rows, 1):
        require(row[0] == str(number), "TODO 顺序需连续")
        task = tasks[row[1]]
        require(all(key in order[:number-1] for key in task["meta"]["depends_on"]), "TODO 越过前置依赖")
        link = re.fullmatch(r"\[[^\]]+\]\(([^)]+)\)", row[2])
        require(link and (root / link[1]).resolve() == task["path"], "TODO 链接与工单不一致")
    return tasks, order


def order_index(root, requested=None):
    tasks, order = scan(root)
    if requested:
        order = requested
    elif (root / "README.md").is_file():
        text = (root / "README.md").read_text(encoding="utf-8-sig")
        match = re.search(r"<!-- planning-todo:begin -->(.*?)<!-- planning-todo:end -->", text, re.S)
        if match:
            old = [row[1] for row in parse_rows(match[1], 3, "顺序")]
            require(len(old) == len(set(old)) and all(key in tasks for key in old), "已有 TODO ID 异常，先核对入口")
            order = old + [key for key in order if key not in old]
    require(tasks and len(order) == len(set(order)) and set(order) == set(tasks), "顺序必须列全 task_id 且不重复")
    for index, key in enumerate(order):
        require(all(dep in order[:index] for dep in tasks[key]["meta"]["depends_on"]), "指定顺序越过前置依赖")
    readme = root / "README.md"
    require(readme.is_file() and readme.resolve().is_relative_to(root), "缺少有效任务入口")
    rows = [f"| {number} | {key} | [{tasks[key]['meta']['class']}]({reference(readme, tasks[key]['path'])}) |" for number, key in enumerate(order, 1)]
    block = "<!-- planning-todo:begin -->\n\n## TODO 与执行顺序\n\n| 顺序 | 任务 ID | 工单 |\n| --- | --- | --- |\n" + "\n".join(rows) + "\n\n<!-- planning-todo:end -->"
    text = readme.read_text(encoding="utf-8-sig")
    if "<!-- planning-todo:begin -->" in text:
        require("<!-- planning-todo:end -->" in text, "TODO 标记不完整")
        text = re.sub(r"<!-- planning-todo:begin -->.*?<!-- planning-todo:end -->", lambda _: block, text, flags=re.S)
    else:
        text += "\n\n" + block + "\n"
    write(readme, text)
    return order
