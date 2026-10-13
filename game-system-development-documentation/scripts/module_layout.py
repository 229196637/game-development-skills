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
