"""只编写和校验规划工单；执行操作属于独立执行技能。"""
from task_store import *

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("rules")
    for name in ("init", "update", "relocate", "check", "list", "order"):
        command = sub.add_parser(name)
        command.add_argument("--root", required=True, type=Path)
        if name in ("check", "list", "order"):
            if name == "order":
                command.add_argument("--id", action="append")
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
    args = parser.parse_args()
    if args.action == "rules":
        return {"order": "先文档后规划", "owner": "逐类工单", "default_mode": "文档与规划，交付后停止", "execution": "使用 game-system-development-execution；规划没有执行命令", "meta": KEYS,
                "completion": "前置完成、工作项勾选、每项必需测试与验收最近 passed；不证明真实测试执行"}
    root = args.root.resolve()
    require(".git" not in root.parts, "任务根不能是 .git")
    if args.action == "order":
        return {"order": order_index(root, args.id)}
    if args.action == "init":
        path = location(root, args.file)
        require(not path.exists(), "拒绝覆盖已有任务")
        document = args.document.resolve()
        require(document.is_file() and document.suffix.lower() == ".md", "对应文档必须已存在")
        require(not document.is_relative_to(root), "对应文档必须在执行任务根之外")
        identifier = nonempty(args.id)
        require(re.fullmatch(r"[\w.-]+", identifier), "task_id 格式错误")
        tasks, _ = scan(root, enforce_layout=False)
        require(identifier not in tasks, "任务 ID 已存在")
        require(len(args.depends_on) == len(set(args.depends_on)), "前置 ID 重复")
        for dependency in args.depends_on:
            require(dependency in tasks, f"请先登记前置任务：{dependency}")
        class_name = nonempty(args.class_name)
        check_mirror(root, path, document, class_name)
        tests = [nonempty(x) for x in args.required_test]
        require(len(tests) == len(set(tests)) and all("|" not in x for x in tests), "测试 ID 重复或含 |")
        goal = nonempty(args.goal)
        items = [nonempty(x) for x in args.item]
        document_ref = os.path.relpath(document, path.parent).replace("\\", "/")
        brief, items, criteria, index, standards = specification(args, path, document)
        meta = dict(zip(KEYS, (identifier, class_name, document_ref, "todo", args.depends_on, tests, [x[0] for x in criteria], now())))
        body = work_order(class_name, goal, brief, items, index, standards)
        save({"path": path, "meta": meta, "body": body})
        directories(root, path)
        order_index(root)
        return {"created": str(path), "status": "todo"}
    tasks, order = scan(root, enforce_layout=args.action not in ("relocate", "update"))
    if args.action in ("check", "list"):
        tasks, order = todo_order(root)
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
    if args.action == "relocate":
        modern(task)
        destination = location(root, mirrored_file(task["document"]).as_posix())
        if destination == path:
            return {"file": str(path), "action": "relocate", "changed": False}
        require(not destination.exists(), "镜像目标已存在，拒绝覆盖")
        def remap(match):
            ref = match[1]
            if re.match(r"[a-z]+://", ref) or ref.startswith("#"):
                return ref
            raw, separator, anchor = ref.partition("#")
            target = (path.parent / raw).resolve()
            return reference(destination, target) + (separator + anchor if separator else "")
        task["body"] = re.sub(r"(?<=\]\()([^)]*)(?=\))", remap, task["body"])
        task["meta"]["document"] = reference(destination, task["document"])
        task["path"] = destination
        save(task)
        directories(root, destination)
        # 将原各级 README 的直接类链接改到新位置，保留手写说明。
        for readme in root.rglob("README.md"):
            require(readme.resolve().is_relative_to(root), "README 链接越界")
            original = readme.read_text(encoding="utf-8-sig")
            def nav(match):
                raw = match[1]
                if not raw or re.match(r"[a-z]+://", raw):
                    return raw
                part, separator, anchor = raw.partition("#")
                if (readme.parent / part).resolve() != path:
                    return raw
                return reference(readme, destination) + (separator + anchor if separator else "")
            updated = re.sub(r"(?<=\]\()([^)]*)(?=\))", nav, original)
            if updated != original:
                write(readme, updated)
        path.unlink()
        order_index(root)
        return {"from": str(path), "file": str(destination), "action": "relocate", "status": task["meta"]["status"], "records_preserved": True}
    if args.action == "update":
        require(task["meta"]["status"] != "doing", "领取中的工单先由执行者 release，再修订规划")
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


if __name__ == "__main__":
    try:
        print(json.dumps({"ok": True, "result": main()}, ensure_ascii=False, indent=2))
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False, indent=2))
        sys.exit(1)
