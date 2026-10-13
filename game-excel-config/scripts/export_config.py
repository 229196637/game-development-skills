"""Project-configured one-command config export. The runner does not impose a target language."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def project_path(root: Path, value: str) -> Path:
    """Resolve a declared project-relative path, rejecting escape through .. or symlinks."""
    if not isinstance(value, str) or not value.strip() or Path(value).is_absolute():
        raise ValueError("配置路径必须为非空项目相对路径")
    target = (root / value).resolve()
    if not target.is_relative_to(root):
        raise ValueError(f"配置路径越过项目根：{value}")
    return target


def read_profile(root: Path, path: Path) -> tuple[dict, Path, dict[str, Path]]:
    """Read export routing; paths are project data, not inferred from the skill's directory."""
    profile = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(profile, dict):
        raise ValueError("项目导出配置必须是 JSON 对象")
    if type(profile.get("version")) is not int or profile.get("version") != 1 or profile.get("adapter") not in {"legacy-xls-csharp", "command"}:
        raise ValueError("支持 version=1，adapter 为 legacy-xls-csharp 或 command")
    source = project_path(root, profile["source"])
    if not source.is_dir():
        raise ValueError(f"配置源目录不存在：{source}")
    values = profile.get("outputs")
    if not isinstance(values, dict) or not values:
        raise ValueError("outputs 必须声明固定的项目输出路径")
    if any(not isinstance(name, str) or not name.strip() for name in values):
        raise ValueError("outputs 的名称必须为非空字符串")
    outputs = {name: project_path(root, value) for name, value in values.items()}
    if len(set(outputs.values())) != len(outputs):
        raise ValueError("不同输出不能指向同一目录")
    if any(left != right and left.is_relative_to(right) for left in outputs.values() for right in outputs.values()):
        raise ValueError("不同输出目录不能父子重叠")
    if any(path == root or path == source or path.is_relative_to(source) or source.is_relative_to(path) for path in outputs.values()):
        raise ValueError("输出不能覆盖项目根或配置源目录")
    return profile, source, outputs


def commands(root: Path, profile: dict, source: Path, outputs: dict[str, Path]) -> tuple[list[str], list[str]]:
    """Build argv without a shell. Existing language-specific behavior belongs to the adapter."""
    if profile["adapter"] == "legacy-xls-csharp":
        if set(outputs) != {"client", "server", "calculation_client", "calculation_server"}:
            raise ValueError("legacy 适配器需声明双端配置及公式输出")
        for side in ("client", "server"):
            expected = outputs[side].parent.parent / "Calculation" / outputs[side].name
            if outputs["calculation_" + side] != expected:
                raise ValueError("公式输出必须与当前 legacy 导出器的真实派生路径一致")
        if not any(source.rglob("*.xls")):
            raise ValueError("没有 .xls 源表，停止导出，避免将现有产物清理为空")
        script = Path(__file__).parent / "adapters/legacy_xls_csharp/generate_config_tables.py"
        argv = [sys.executable, str(script), "--source", str(source), "--client-output", str(outputs["client"]), "--server-output", str(outputs["server"])]
        return argv, argv + ["--check"]
    context = {"python": sys.executable, "project": str(root), "source": str(source)}
    context.update({"output_" + name: str(value) for name, value in outputs.items()})
    result = []
    for field in ("export_command", "check_command"):
        argv = profile.get(field)
        if not isinstance(argv, list) or not argv or any(not isinstance(value, str) or not value for value in argv):
            raise ValueError(f"{field} 必须为非空 argv 数组，不接受 shell 字符串")
        result.append([value.format_map(context) for value in argv])
    return result[0], result[1]


def main() -> int:
    """Export then verify, or use --check for a read-only invocation of the declared checker."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", required=True, type=Path)
    parser.add_argument("--profile", type=Path, default=Path("mytool/config-export.json"))
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--format", action="store_true", help="显式执行项目声明的格式化器；可能修改源表")
    parser.add_argument("--describe", action="store_true", help="只读显示路径及实际命令，不执行")
    args = parser.parse_args()
    if args.check and args.format:
        parser.error("--check 不允许 --format 修改源表")
    root = args.project_root.resolve()
    if not root.is_dir():
        raise ValueError("项目根不存在")
    profile_path = args.profile if args.profile.is_absolute() else root / args.profile
    profile, source, outputs = read_profile(root, profile_path)
    export, check = commands(root, profile, source, outputs)
    context = {"python": sys.executable, "project": str(root), "source": str(source)}
    format_command = profile.get("format_command")
    if args.format and (not isinstance(format_command, list) or not format_command or any(not isinstance(value, str) or not value for value in format_command)):
        raise ValueError("项目未声明有效 format_command")
    selected = [check] if args.check else [export, check]
    if args.format:
        selected.insert(0, [value.format_map(context) for value in format_command])
    python_paths = profile.get("python_paths", [])
    if not isinstance(python_paths, list) or any(not isinstance(value, str) or not value for value in python_paths):
        raise ValueError("python_paths 必须为项目相对目录字符串数组")
    helpers = [str(project_path(root, value)) for value in python_paths]
    if any(not Path(value).is_dir() for value in helpers):
        raise ValueError("python_paths 引用的项目帮助模块目录不存在")
    if args.describe:
        print(json.dumps({"project_root": str(root), "adapter": profile["adapter"], "source": str(source), "outputs": {name: str(path) for name, path in outputs.items()}, "commands": selected}, ensure_ascii=False, indent=2))
        return 0
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONDONTWRITEBYTECODE": "1", "GAME_CONFIG_PROJECT_ROOT": str(root)}
    env["PYTHONPATH"] = os.pathsep.join(helpers + ([env["PYTHONPATH"]] if env.get("PYTHONPATH") else []))
    for argv in selected:
        result = subprocess.run(argv, cwd=root, env=env, shell=False)
        if result.returncode:
            return result.returncode
    print(json.dumps({"ok": True, "adapter": profile["adapter"], "check_only": args.check, "outputs": {name: str(value) for name, value in outputs.items()}}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
