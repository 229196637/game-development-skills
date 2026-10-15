"""Read-only game design checks. Does not decide rules or confirm user choices."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

import yaml


class UniqueLoader(yaml.SafeLoader):
    """Reject duplicate keys so a later value cannot conceal an earlier one."""


def mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in result:
            raise ValueError("重复 meta 字段: " + str(key))
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)


def links(body):
    # Code samples are not active Markdown navigation; Mermaid click targets are.
    clean = re.sub(r"```.*?```", "", body, flags=re.S)
    refs = re.findall(r"!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+\"[^\"]*\")?\s*\)", clean)
    refs += re.findall(r'^\s*click\s+\S+\s+"([^"]+)"', body, re.M)
    return [ref.strip("<>") for ref in refs]


def anchors(raw):
    raw = re.sub(r"```.*?```", "", raw, flags=re.S)
    result, seen = set(), {}
    for title in re.findall(r"^#{1,6}\s+(.+?)\s*#*\s*$", raw, re.M):
        name = re.sub(r"[^\w\s-]", "", title.lower()).replace(" ", "-")
        number = seen.get(name, 0)
        seen[name] = number + 1
        result.add(name if number == 0 else f"{name}-{number}")
    return result


def check(root):
    """Inspect an existing docs/策划 tree; return JSON-safe findings without writes."""
    root = Path(root).resolve()
    if root.name != "策划" or not root.is_dir():
        raise ValueError("--root 必须指向已有的 docs/策划 目录")
    docs = root.parent
    issues, bodies = [], {}

    def issue(file, rule, message):
        issues.append({"file": str(file), "rule": rule, "message": message})

    def target(file, ref):
        parsed = urlsplit(ref)
        if parsed.scheme in {"https", "http", "mailto"}:
            return None
        if parsed.scheme or parsed.netloc or re.match(r"^[A-Za-z]:", ref):
            raise ValueError("不支持的链接类型")
        path = (file.parent / unquote(parsed.path)).resolve() if parsed.path else file
        if not path.is_relative_to(docs):
            raise ValueError("链接超出 docs 允许范围")
        if not path.is_file():
            raise ValueError("链接文件不存在: " + ref)
        if parsed.fragment and path.suffix.lower() == ".md":
            if unquote(parsed.fragment) not in anchors(path.read_text(encoding="utf-8-sig")):
                raise ValueError("标题锚点不存在: " + ref)
        return path

    for directory, names, files in os.walk(root, followlinks=False):
        parent = Path(directory)
        names[:] = sorted(n for n in names if not n.startswith("."))
        for name in names[:]:
            folder = parent / name
            if folder.is_symlink() or folder.is_junction():
                issue(folder, "PATH", "不遍历目录链接")
                names.remove(name)
        if not (parent / "README.md").is_file():
            issue(parent, "README", "每个策划目录需要 README.md")
        for name in sorted(files):
            file = parent / name
            if name.startswith(".") or file.suffix.lower() != ".md":
                continue
            if file.is_symlink() or not file.resolve().is_relative_to(root):
                issue(file, "PATH", "不读取文件链接")
                continue
            try:
                raw = file.read_text(encoding="utf-8-sig")
                match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)", raw, re.S)
                if not match:
                    raise ValueError("缺少 YAML meta")
                meta = yaml.load(match[1], Loader=UniqueLoader)
                if not isinstance(meta, dict):
                    raise ValueError("meta 必须为对象")
                if set(meta) != {"system", "updated", "dependencies"}:
                    issue(file, "META", "meta 仅保留 system、updated、dependencies")
                if not isinstance(meta.get("system"), str) or not meta["system"].strip():
                    issue(file, "SYSTEM", "system 必须为非空字符串")
                updated = meta.get("updated")
                if not isinstance(updated, str) or not re.fullmatch(
                    r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}", updated
                ):
                    issue(file, "TIME", "updated 需要带时区的人类可读时间")
                else:
                    dt.datetime.strptime(updated, "%Y-%m-%d %H:%M:%S %z")
                body = raw[match.end():]
                bodies[file] = body
                dependencies = meta.get("dependencies")
                if not isinstance(dependencies, list) or any(not isinstance(d, str) or not d for d in dependencies):
                    issue(file, "DEPENDENCIES", "dependencies 必须为文档路径数组")
                    dependencies = []
                for ref in dependencies:
                    resolved = target(file, ref)
                    if resolved is None or resolved.suffix.lower() != ".md":
                        issue(file, "DEPENDENCIES", "依赖必须指向 docs 内 Markdown")
                for ref in links(body):
                    target(file, ref)
            except (OSError, UnicodeError, ValueError, yaml.YAMLError) as error:
                issue(file, "CONTENT", str(error).splitlines()[0])

    for system in sorted(root.iterdir()):
        if system.name.startswith(".") or not system.is_dir() or system.is_symlink() or system.is_junction():
            continue
        main = system / "策划.md"
        index = root / "README.md"
        if index in bodies:
            refs = [ref.split("#")[0] for ref in links(bodies[index])]
            if f"{system.name}/README.md" not in refs and f"{system.name}/策划.md" not in refs:
                issue(index, "INDEX", "根 README 需要链接系统入口: " + system.name)
        if main not in bodies:
            issue(main, "DESIGN", "系统需要可读取的策划.md")
            continue
        scope = [main]
        for ref in links(bodies[main]):
            try:
                linked = target(main, ref)
                if linked in bodies and linked.parent.is_relative_to(system) and linked.name not in {"README.md", "待确认.md"}:
                    scope.append(linked)
            except (ValueError, OSError):
                pass  # The earlier pass already reports the bad link.
        content = "\n".join(bodies[p] for p in scope)
        if not re.search(r"```mermaid\s*\n(?:%%[^\n]*\n|\s)*(?:flowchart|graph)\s+", content):
            issue(main, "FLOW", "系统需要 Mermaid 核心玩法流程图")
        rules = re.findall(r"^#{1,6} +规则\s*\n(.*?)(?=^#{1,6} |\Z)", content, re.M | re.S)
        if not any(re.search(r"^\|.+\|\s*\n\|[ :|\-]+\|\s*\n\|.+\|", part, re.M) for part in rules):
            issue(main, "RULES", "规则章节需要含实际规则行的表格")
        readme = system / "README.md"
        if readme in bodies and not any(
            ref.split("#")[0] == "策划.md" for ref in links(bodies[readme])
        ):
            issue(readme, "INDEX", "系统 README 需要链接策划.md")
        pending = system / "待确认.md"
        if pending in bodies:
            rows = [line.strip().strip("|").split("|") for line in bodies[pending].splitlines()
                    if re.match(r"^\|\s*Q-[^|]+\|", line)]
            if not rows:
                issue(pending, "PENDING", "待确认表需要实际问题行，问题 ID 使用 Q- 前缀")
            ids = set()
            for row in rows:
                row = [cell.strip() for cell in row]
                if len(row) != 7 or row[4] not in {"待确认", "已解决"}:
                    issue(pending, "PENDING", "问题表使用七列，状态为待确认或已解决")
                    continue
                if row[0] in ids:
                    issue(pending, "PENDING", "重复问题 ID: " + row[0])
                ids.add(row[0])
                if not row[1] or not row[2] or not row[3] or not links(row[6]):
                    issue(pending, "PENDING", "问题、候选、影响与正文链接不能为空")
                if row[4] == "已解决" and row[5] in {"", "尚未决定", "待讨论", "—"}:
                    issue(pending, "PENDING", "已解决的问题需要决定及真实来源")
        if pending in bodies and readme in bodies and not any(
            ref.split("#")[0] == "待确认.md" for ref in links(bodies[readme])
        ):
            issue(readme, "INDEX", "系统 README 需要链接已有待确认.md")
    return {"ok": not issues, "files": len(bodies), "issues": issues}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["check"])
    parser.add_argument("--root", required=True)
    args = parser.parse_args()
    try:
        result = check(args.root)
    except (OSError, ValueError) as error:
        result = {"ok": False, "files": 0, "issues": [{"rule": "ROOT", "message": str(error)}]}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
