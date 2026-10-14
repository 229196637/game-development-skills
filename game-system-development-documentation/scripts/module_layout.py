"""模块优先目录约束；供设计态与已实现态检查共用，不修改文件。"""
import re
from pathlib import Path

RESERVED = {"职责", "api", "设计", "client", "server", "shared"}


def validate_layout(file, fail):
    if "文档" not in file.parts:
        return
    position = file.parts.index("文档")
    root = Path(*file.parts[:position + 1])
    relative = file.relative_to(root)
    if relative.parts[0] in RESERVED:
        fail(file, "MODULE_LAYOUT", "expected 文档/<模块>/..., not a top-level role/API/side/design directory")
        return
    if file.name == "README.md" and (file.parent == root or file.parent.parent.name == "设计"):
        entry_map(file, fail)
    if len(relative.parts) == 1:
        if file.name not in {"README.md", "目录架构.md"}:
            fail(file, "MODULE_LAYOUT", "system contents belong inside 文档/<模块>/")
        return
    module = root / relative.parts[0]
    for entry in (module / "README.md", module / "目录架构.md"):
        if not entry.is_file():
            fail(file, "MODULE_ENTRY", "module requires same-level README.md and 目录架构.md: " + str(entry))
    if file.name == "README.md" and file.parent == module:
        entry_map(file, fail)


def entry_map(file, fail):
    architecture = file.parent / "目录架构.md"
    if not architecture.is_file():
        fail(file, "DIRECTORY_MAP", "entry requires same-level 目录架构.md")
    else:
        refs = re.findall(r"\[[^\]]*\]\(([^)]+)\)", file.read_text(encoding="utf-8-sig"))
        if not any((file.parent / ref.split("#")[0]).resolve() == architecture.resolve() for ref in refs if not re.match(r"[a-z]+://", ref)):
            fail(file, "DIRECTORY_MAP_LINK", "README must directly link its same-level 目录架构.md")


def validate_class_diagrams(file, body, fail):
    """含类索引的 README 必须提供两张独立总览；业务关系准确性仍人工核对。"""
    index = re.search(r"^## 类索引[ \t]*\n(.*?)(?=^## |\Z)", body, re.S | re.M)
    if file.name != "README.md" or not index:
        return
    classes = []
    for row in index[1].splitlines():
        if not row.strip().startswith("|"):
            continue
        cells = [x.strip() for x in row.strip().strip("|").split("|")]
        if len(cells) >= 5 and cells[0] != "类" and not re.fullmatch(r"[-: ]+", cells[0]):
            refs = re.findall(r"\[[^\]]+\]\(([^)]+)\)", cells[4])
            if refs:
                classes.append((re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cells[0]), (file.parent / refs[0].split("#")[0]).resolve()))
    for title, code in (("职责架构图", "ENTRY_RESPONSIBILITY_DIAGRAM"), ("系统依赖图", "ENTRY_DEPENDENCY_DIAGRAM")):
        section = re.search(r"^## " + title + r"[ \t]*\n(.*?)(?=^## |\Z)", body, re.S | re.M)
        diagrams = re.findall(r"```mermaid[^\n]*\n(.*?)```", section[1], re.S) if section else []
        if not diagrams or not any(re.search(r"^\s*(?:flowchart|graph)\s+", graph, re.M) for graph in diagrams):
            fail(file, code, "class-index README requires a Mermaid flowchart under ## " + title)
            continue
        graph = "\n".join(diagrams)
        clicks = re.findall(r'click\s+\w+\s+"([^"\n]+)"', graph)
        targets = set()
        for ref in clicks:
            if re.match(r"[a-z]+://", ref):
                continue
            target = (file.parent / ref.split("#")[0]).resolve()
            if not target.is_file() or target.suffix.lower() != ".md":
                fail(file, "ENTRY_DIAGRAM_LINK", "diagram must link an existing Markdown document: " + ref)
            targets.add(target)
        if not targets:
            fail(file, "ENTRY_DIAGRAM_LINK", "entry overview requires clickable document nodes")
        if title == "职责架构图":
            for name, target in classes:
                if name not in graph or target not in targets:
                    fail(file, "ENTRY_CLASS_DIAGRAM", "responsibility overview must name and link indexed class: " + name)
