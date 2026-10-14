"""按 README TODO 领取工单、执行真实测试并记录；不生成业务实现。"""
import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "game-system-development-planning" / "scripts"))
from task_store import (require, nonempty, now, scan, todo_order, read, save, section,
                        replace_section, append_row, completion, invalidate, modern)

CLAIM = r"<!-- execution-claim: (.*?) -->"


def owner(task):
    match = re.search(CLAIM, task["body"])
    return json.loads(match[1]) if match else None


def set_owner(task, value):
    body = re.sub(CLAIM + r"\n?", "", task["body"])
    if value:
        head, separator, rest = body.partition("\n")
        body = head + separator + "<!-- execution-claim: " + json.dumps(value, ensure_ascii=False) + " -->\n" + rest
    task["body"] = body


@contextmanager
def lock(root):
    target = root / ".execution.lock"
    require(target.resolve().is_relative_to(root), "锁文件越界")
    try:
        descriptor = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise ValueError("任务根正在被操作；若进程已退出，核对后清理遗留锁，不抢占任务")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(json.dumps({"pid": os.getpid(), "time": now()}))
        yield
    finally:
        target.unlink()


def candidates(tasks, order):
    return [key for key in order if tasks[key]["meta"]["status"] == "todo"
            and not owner(tasks[key])
            and all(tasks[dep]["meta"]["status"] == "completed" for dep in tasks[key]["meta"]["depends_on"])]


def details(task):
    links = re.findall(r"\[[^\]]+\]\(([^)]+)\)", section(task["body"], "文档索引"))
    return {"id": task["meta"]["task_id"], "file": str(task["path"]), "status": task["meta"]["status"],
            "claim": owner(task), "document": str(task["document"]),
            "references": [str((task["path"].parent / ref.split("#")[0]).resolve()) for ref in links],
            "items": task["items"], "required_tests": task["meta"]["required_tests"],
            "acceptance": section(task["body"], "验收标准").strip()}


def report_target(root, folder):
    folder = folder.resolve()
    require(not folder.is_relative_to(root) and ".git" not in folder.parts, "测试报告必须位于工单根外，例如 docs/测试/<任务>；不放正式文档")
    require("文档" not in folder.parts, "正式文档目录不能包含测试报告")
    return folder


def run_test(args, root, task):
    require(args.test_id in task["meta"]["required_tests"], "未知测试 ID")
    folder = report_target(root, args.report_root)
    require(args.cwd.is_dir(), "测试工作目录不存在")
    require(args.timeout > 0, "timeout 必须大于 0")
    argv = [args.program] + args.arg
    folder.mkdir(parents=True, exist_ok=True)
    base = folder / (task["meta"]["task_id"] + "-" + args.test_id + "-" + uuid.uuid4().hex[:12])
    log = base.with_suffix(".log")
    report = base.with_suffix(".md")
    require(report.resolve().is_relative_to(folder) and log.resolve().is_relative_to(folder), "报告路径越界")
    started = now()
    exit_code = None
    with log.open("w", encoding="utf-8") as stream:
        try:
            process = subprocess.run(argv, cwd=args.cwd, stdout=stream, stderr=subprocess.STDOUT,
                                     timeout=args.timeout, shell=False)
            exit_code = process.returncode
            actual = "进程退出码 " + str(exit_code)
        except (OSError, subprocess.TimeoutExpired) as error:
            actual = str(error)
            stream.write("\n" + actual)
    result = "passed" if exit_code == 0 else "failed"
    digest = hashlib.sha256(log.read_bytes()).hexdigest()
    report.write_text("# 测试报告\n\n" + f"- 工单：{task['meta']['task_id']}\n- 测试：{args.test_id}\n- 开始：{started}\n- 结束：{now()}\n- 代码版本：{args.revision}\n- 工作目录：{args.cwd.resolve()}\n- 命令参数：`{json.dumps(argv, ensure_ascii=False)}`\n- 预期：{args.expected}\n- 实际：{actual}\n- 结果：{result}\n- 日志 SHA256：{digest}\n- [完整日志]({log.name})\n\n退出码仅证明该命令成功；覆盖范围和验收条件仍需逐项核对。\n", encoding="utf-8")
    append_row(task, "测试过程", [now(), args.test_id, json.dumps(argv, ensure_ascii=False), args.expected, actual, result, str(report)])
    return {"report": str(report), "log": str(log), "result": result, "exit_code": exit_code}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    for name in ("next", "show", "claim", "set-item", "run-test", "record-test", "record-acceptance", "block", "release", "reopen", "complete"):
        command = sub.add_parser(name)
        command.add_argument("--entry", required=True, type=Path)
        if name != "next":
            command.add_argument("--id", required=name != "claim")
        if name not in ("next", "show"):
            command.add_argument("--owner", required=True)
        if name == "set-item":
            command.add_argument("--number", type=int, required=True)
            command.add_argument("--value", choices=("done", "pending"), required=True)
        if name == "run-test":
            command.add_argument("--test-id", required=True)
            command.add_argument("--program", required=True)
            command.add_argument("--arg", action="append", default=[])
            command.add_argument("--cwd", type=Path, required=True)
            command.add_argument("--timeout", type=int, default=300)
            command.add_argument("--report-root", type=Path, required=True)
            command.add_argument("--expected", required=True)
            command.add_argument("--revision", required=True)
        if name == "record-test":
            for field in ("test-id", "command", "expected", "actual", "result"):
                command.add_argument("--" + field, required=True, **({"choices": ("passed", "failed", "not-run")} if field == "result" else {}))
            command.add_argument("--report", type=Path, required=True)
        if name == "record-acceptance":
            for field in ("acceptance-id", "actual", "evidence"):
                command.add_argument("--" + field, required=True)
            command.add_argument("--result", choices=("passed", "failed", "not-run"), required=True)
        if name in ("block", "release", "reopen"):
            command.add_argument("--reason", required=True)
    args = parser.parse_args()
    entry = args.entry.resolve()
    require(entry.name == "README.md" and entry.is_file(), "--entry 必须指向任务入口 README.md")
    root = entry.parent
    require(".git" not in root.parts, "任务根不能是 .git")
    if args.action in ("next", "show"):
        tasks, order = todo_order(root)
        for task in tasks.values():
            if task["meta"]["status"] == "completed":
                completion(task, tasks)
        if args.action == "next":
            ready = candidates(tasks, order)
            return {"ready": ready, "next": details(tasks[ready[0]]) if ready else None,
                    "remaining": [key for key in order if tasks[key]["meta"]["status"] != "completed"]}
        require(args.id in tasks, "未知工单")
        return details(tasks[args.id])
    nonempty(args.owner)
    require("-->" not in args.owner, "owner 不得含注释结束标记")
    with lock(root):
        tasks, order = todo_order(root)
        for task in tasks.values():
            if task["meta"]["status"] == "completed":
                completion(task, tasks)
        if args.action == "claim":
            ready = candidates(tasks, order)
            require(ready, "没有可领取任务；检查阻塞、在办与前置")
            identifier = args.id or ready[0]
            require(identifier in ready, "该任务不可领取：已领、非 todo 或前置未完成")
            # 同一批可执行任务按入口顺序领取，不能跳过更高优先级。
            require(identifier == ready[0], "请先领取入口中更靠前的可执行任务：" + ready[0])
            task = tasks[identifier]
            modern(task)
            task["meta"]["status"] = "doing"
            set_owner(task, {"owner": args.owner, "time": now()})
            save(task)
            return details(task)
        require(args.id in tasks, "未知工单")
        task = tasks[args.id]
        modern(task)
        if args.action == "reopen":
            require(task["meta"]["status"] in ("completed", "blocked"), "只重开完成或阻塞工单")
            require(not owner(task) or owner(task)["owner"] == args.owner, "任务由其他执行者持有")
            invalidate(task, nonempty(args.reason))
            task["meta"]["status"] = "todo"
            set_owner(task, None)
        else:
            claim = owner(task)
            require(claim and claim["owner"] == args.owner, "先领取任务；不能修改他人领取的工单")
            require(task["meta"]["status"] == "doing", "任务必须处于 doing")
            if args.action == "set-item":
                require(1 <= args.number <= len(task["items"]), "工作项序号越界")
                entries = task["items"][:]
                entries[args.number - 1] = ("x" if args.value == "done" else " ", entries[args.number - 1][1])
                task["body"] = replace_section(task["body"], "任务内容", "\n".join(f"- [{mark}] {text}" for mark, text in entries))
                if args.value == "pending":
                    invalidate(task, "工作项退回，重新测试与验收")
            elif args.action == "run-test":
                result = run_test(args, root, task)
                save(task)
                return result
            elif args.action == "record-test":
                require(args.test_id in task["meta"]["required_tests"], "未知测试 ID")
                report = args.report.resolve()
                report_target(root, report.parent)
                require(report.is_file(), "须先存在真实测试报告")
                append_row(task, "测试过程", [now(), args.test_id, args.command, args.expected, args.actual, args.result, str(report)])
            elif args.action == "record-acceptance":
                require(args.acceptance_id in task["meta"]["required_acceptance"], "未知验收 ID")
                append_row(task, "验收情况", [now(), args.acceptance_id, args.actual, args.result, args.evidence])
            elif args.action in ("block", "release"):
                invalidate(task, nonempty(args.reason))
                task["meta"]["status"] = "blocked" if args.action == "block" else "todo"
                set_owner(task, None)
            elif args.action == "complete":
                completion(task, tasks)
                latest = {row[1]: row for row in task["tests"]}
                for key in task["meta"]["required_tests"]:
                    require(Path(latest[key][6]).is_file(), "测试报告不存在；请重新生成或记录真实报告")
                task["meta"]["status"] = "completed"
                set_owner(task, None)
        save(task)
        return details(task)


if __name__ == "__main__":
    try:
        result = main()
        print(json.dumps({"ok": True, "result": result}, ensure_ascii=False, indent=2))
        if isinstance(result, dict) and result.get("result") == "failed":
            sys.exit(1)
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False, indent=2))
        sys.exit(1)
