"""只读检查美术定稿及保存的参考图；不写文件、不替用户确认方向。"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys


def _resolve(m_root, m_relative):
    # 库移动后仍用相对路径；阻止越界和符号链接指向库外的文件。
    if not isinstance(m_relative, str) or not m_relative or "\\" in m_relative:
        raise ValueError("必须使用非空的库内 POSIX 相对路径")
    m_parts = PurePosixPath(m_relative)
    if m_parts.is_absolute() or ".." in m_parts.parts or ":" in m_relative:
        raise ValueError(f"路径越界: {m_relative}")
    m_path = (m_root / m_relative).resolve()
    if not m_path.is_relative_to(m_root):
        raise ValueError("引用指向资源库以外")
    return m_path


def _text(m_value, m_label):
    if not isinstance(m_value, str) or not m_value.strip():
        raise ValueError(f"{m_label} 必须为非空字符串")
    return m_value


def _readDirection(m_path):
    import yaml
    m_text = m_path.read_text(encoding="utf-8-sig")
    m_match = re.match(r"\A---\s*\n(.*?)\n---(?:\n|$)", m_text, re.S)
    if not m_match:
        raise ValueError("定稿入口缺少 YAML frontmatter")
    try:
        m_meta = yaml.safe_load(m_match.group(1))
    except yaml.YAMLError as m_error:
        raise ValueError(f"定稿 YAML 无效: {m_error}") from m_error
    if not isinstance(m_meta, dict):
        raise ValueError("定稿元数据必须为对象")
    if not m_text[m_match.end():].strip():
        raise ValueError("定稿入口缺少人可读的决定正文")
    return m_meta


def _inspectImage(m_path):
    from PIL import Image
    with Image.open(m_path) as m_image:
        m_width, m_height, m_format = m_image.width, m_image.height, m_image.format
        m_image.verify()
    return {"width": m_width, "height": m_height, "format": m_format,
            "sha256": hashlib.sha256(m_path.read_bytes()).hexdigest()}


def _check(m_root, m_direction):
    """按入口、状态、版本路径、认可图依次检查；仅确认记录完整时返回制作入口。"""
    # 1. 读取状态与设计约束，避免把空的讨论记录误当成生产决定。
    m_meta = _readDirection(_resolve(m_root, m_direction))
    if type(m_meta.get("schema_version")) is not int or m_meta["schema_version"] != 1:
        raise ValueError("只支持 schema_version=1")
    m_status = m_meta.get("status")
    if m_status not in ("discussing", "confirmed"):
        raise ValueError("status 必须为 discussing/confirmed")
    m_scope = _text(m_meta.get("scope"), "scope")
    m_canvas = m_meta.get("design_canvas")
    if not isinstance(m_canvas, dict) or any(type(m_canvas.get(m_key)) is not int or m_canvas[m_key] <= 0 for m_key in ("width", "height")):
        raise ValueError("design_canvas 必须包含正整数 width/height")
    for m_key in ("candidates_file", "discussion_file"):
        if m_meta.get(m_key) and not _resolve(m_root, m_meta[m_key]).is_file():
            raise ValueError(f"{m_key} 引用文件不存在")
    m_result = {"valid": True, "ready": False, "status": m_status,
                "direction": m_direction, "scope": m_scope, "design_canvas": m_canvas,
                "gaps": [], "errors": []}
    m_selected = m_meta.get("selected")
    if m_selected is None:
        if m_status == "confirmed":
            raise ValueError("已确认记录没有 selected 风格")
        m_result["gaps"].append("美术风格仍在讨论，尚无用户明确定稿")
        return m_result
    if not isinstance(m_selected, dict):
        raise ValueError("selected 必须为对象或 null")
    # 2. 核对精确版本与文档位置，不根据候选名字猜测要使用的档案。
    m_styleId = _text(m_selected.get("style_id"), "style_id")
    m_version = _text(m_selected.get("style_version"), "style_version")
    for m_identity in (m_styleId, m_version):
        if any(m_char in m_identity for m_char in ("/", "\\", ":")) or m_identity in (".", ".."):
            raise ValueError("风格ID和版本必须为单个目录名")
    m_prefix = f"styles/{m_styleId}/{m_version}"
    m_styleFile = m_selected.get("style_file")
    if m_styleFile != f"{m_prefix}/style.md":
        raise ValueError("style_file 与选定风格ID/版本不对应")
    m_styleText = _resolve(m_root, m_styleFile).read_text(encoding="utf-8-sig")
    if not m_styleText.strip():
        raise ValueError("完整风格文档为空")
    m_catalogPath = m_root / "catalog.json"
    if m_catalogPath.exists():
        m_catalog = json.loads(m_catalogPath.read_text(encoding="utf-8-sig"))
        if not isinstance(m_catalog, dict):
            raise ValueError("资源索引必须为对象")
        m_styles = m_catalog.get("styles")
        if not isinstance(m_styles, list) or any(not isinstance(m_s, dict) for m_s in m_styles):
            raise ValueError("资源索引缺少 styles 列表")
        m_matches = [m_s for m_s in m_styles if m_s.get("id") == m_styleId and m_s.get("version") == m_version]
        if len(m_matches) != 1 or m_matches[0].get("path") != m_styleFile:
            raise ValueError("选定风格与资源索引的版本/路径不一致")
    # 3. 实际验证已保存图片及摘要，防止同一路径的图已被换掉仍当原认可图。
    m_references = m_selected.get("reference_images")
    if not isinstance(m_references, list) or not m_references:
        raise ValueError("选定风格必须保存至少一张认可参考图")
    m_seen, m_images = set(), []
    for m_reference in m_references:
        if not isinstance(m_reference, dict):
            raise ValueError("reference_images 条目必须为 path/sha256 对象")
        m_path = _text(m_reference.get("path"), "参考图路径")
        if not m_path.startswith(f"{m_prefix}/references/"):
            raise ValueError("认可图必须保存在选定风格版本的 references 内")
        if m_path in m_seen:
            raise ValueError("参考图路径重复")
        m_seen.add(m_path)
        m_digest = m_reference.get("sha256")
        if not isinstance(m_digest, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", m_digest):
            raise ValueError("认可图必须记录有效的 SHA256")
        m_actual = _inspectImage(_resolve(m_root, m_path))
        if m_actual["sha256"] != m_digest.lower():
            raise ValueError(f"认可参考图已变化: {m_path}")
        m_images.append({"path": m_path, **m_actual})
    if m_status == "discussing":
        m_result["gaps"].append("选定项仍处于讨论状态，尚未获得明确的用户定稿")
        return m_result
    m_confirmation = m_meta.get("confirmation")
    if not isinstance(m_confirmation, dict):
        raise ValueError("已确认风格缺少真实用户决定记录")
    _text(m_confirmation.get("user_message"), "confirmation.user_message")
    # 4. 只有记录与文件均完整才提供路径；不能据此推断人类真的授权过。
    m_result.update({"ready": True, "style_id": m_styleId, "style_version": m_version,
                     "style_file": m_styleFile, "reference_images": m_images})
    return m_result


def Main():
    """只读CLI：无效记录退出1；handoff未确认退出2；合法检查或就绪交付退出0。"""
    m_parser = argparse.ArgumentParser(description=__doc__)
    m_sub = m_parser.add_subparsers(dest="command", required=True)
    for m_name in ("check", "handoff"):
        m_command = m_sub.add_parser(m_name)
        m_command.add_argument("--root", required=True)
        m_command.add_argument("--direction", default="art-direction.md")
    m_args = m_parser.parse_args()
    try:
        m_root = Path(m_args.root).resolve()
        m_result = _check(m_root, m_args.direction)
        print(json.dumps(m_result, ensure_ascii=False, indent=2))
        return 2 if m_args.command == "handoff" and not m_result["ready"] else 0
    except (OSError, KeyError, TypeError, ValueError, ImportError) as m_error:
        print(json.dumps({"valid": False, "ready": False, "errors": [str(m_error)]}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(Main())
