"""美术资源检索、无覆盖归档和只读检查；不生成或修改图像像素。"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sys
import tempfile


def _readJson(m_path):
    return json.loads(m_path.read_text(encoding="utf-8-sig"))


def _resolve(m_root, m_relative):
    # 索引随库移动；拒绝越界路径，避免消费技能读取库外文件或归档覆盖其它目录。
    if not isinstance(m_relative, str) or not m_relative or "\\" in m_relative:
        raise ValueError("路径必须是非空的 POSIX 相对路径")
    m_parts = PurePosixPath(m_relative)
    if m_parts.is_absolute() or ".." in m_parts.parts or ":" in m_relative:
        raise ValueError(f"路径越界: {m_relative}")
    m_path = (m_root / m_relative).resolve()
    if not m_path.is_relative_to(m_root.resolve()):
        raise ValueError(f"路径越界: {m_relative}")
    return m_path


def _writeJson(m_path, m_value):
    # 临时文件与索引同目录，原子替换防止中断留下半份 JSON。
    m_path.parent.mkdir(parents=True, exist_ok=True)
    m_fd, m_name = tempfile.mkstemp(prefix=".art-", suffix=".tmp", dir=m_path.parent)
    try:
        with os.fdopen(m_fd, "w", encoding="utf-8", newline="\n") as m_file:
            json.dump(m_value, m_file, ensure_ascii=False, indent=2)
            m_file.write("\n")
        os.replace(m_name, m_path)
    finally:
        if os.path.exists(m_name):
            os.unlink(m_name)


def _inspect(m_path):
    from PIL import Image
    with Image.open(m_path) as m_image:
        m_image.load()
        m_alpha = m_image.convert("RGBA").getchannel("A")
        m_min, m_max = m_alpha.getextrema()
        return {"format": m_image.format, "width": m_image.width, "height": m_image.height,
                "has_transparent_pixels": m_min < 255, "has_visible_pixels": m_max > 0,
                "content_bounds": m_alpha.getbbox(),
                "opaque_content_bounds": m_alpha.point(lambda m_v: 255 if m_v >= 128 else 0).getbbox(),
                "sha256": hashlib.sha256(m_path.read_bytes()).hexdigest()}


def _catalog(m_root):
    m_data = _readJson(m_root / "catalog.json")
    if m_data.get("schema_version") != 1:
        raise ValueError("只支持 schema_version=1")
    if not isinstance(m_data.get("styles"), list) or not isinstance(m_data.get("assets"), list):
        raise ValueError("styles/assets 必须为列表")
    return m_data


def _style(m_root, m_data, m_id, m_version):
    m_matches = [m_s for m_s in m_data["styles"] if m_s["id"] == m_id and m_s["version"] == m_version]
    if len(m_matches) != 1:
        raise ValueError(f"风格缺失或重复: {m_id}@{m_version}")
    m_path = _resolve(m_root, m_matches[0]["path"])
    if not m_path.is_file():
        raise ValueError(f"风格文件缺失: {m_path.name}")
    return m_matches[0]


def _size(m_value, m_label):
    if not isinstance(m_value, dict) or any(type(m_value.get(m_key)) is not int or m_value[m_key] <= 0 for m_key in ("width", "height")):
        raise ValueError(f"{m_label} 必须包含正整数 width/height")
    return m_value


def _validateAsset(m_root, m_data, m_asset, m_imagePath):
    m_required = ("id", "version", "category", "purpose", "tags", "style_id", "style_version",
                  "path", "requires_alpha", "source", "production")
    for m_key in m_required:
        if m_key not in m_asset:
            raise ValueError(f"资源字段缺失: {m_key}")
    for m_key in ("id", "version", "purpose", "style_id", "style_version"):
        if not isinstance(m_asset[m_key], str) or not m_asset[m_key].strip():
            raise ValueError(f"{m_key} 必须是非空字符串")
    if m_asset["category"] not in ("backgrounds", "subjects", "shared"):
        raise ValueError("category 必须为 backgrounds/subjects/shared")
    if not isinstance(m_asset["requires_alpha"], bool):
        raise ValueError("requires_alpha 必须为布尔值")
    if not isinstance(m_asset["tags"], list) or any(not isinstance(m_t, str) for m_t in m_asset["tags"]):
        raise ValueError("tags 必须为字符串列表")
    if _resolve(m_root, m_asset["path"]).suffix.lower() != ".png":
        raise ValueError("正式素材路径必须以 .png 结尾")
    _style(m_root, m_data, m_asset["style_id"], m_asset["style_version"])
    if not _resolve(m_root, m_asset["production"]).is_file():
        raise ValueError("生产清单不存在")
    m_manifest = _readJson(_resolve(m_root, m_asset["production"]))
    if (m_manifest["style"]["id"], m_manifest["style"]["version"]) != (m_asset["style_id"], m_asset["style_version"]):
        raise ValueError("资源与生产清单的风格版本不一致")
    if not any((m_a["id"], m_a["version"]) == (m_asset["id"], m_asset["version"]) for m_a in m_manifest["assets"]):
        raise ValueError("资源未列入其生产清单")
    m_source = m_asset["source"]
    if not isinstance(m_source, dict) or m_source.get("kind") not in ("generated", "existing"):
        raise ValueError("source.kind 必须为 generated/existing")
    if not isinstance(m_source.get("origin"), str) or not m_source["origin"]:
        raise ValueError("source.origin 必须描述可追溯来源")
    if m_source["kind"] == "generated" and not m_source.get("prompt"):
        raise ValueError("生成素材必须记录实际提示词路径")
    for m_key in ("prompt", "reference"):
        if m_source.get(m_key) and not _resolve(m_root, m_source[m_key]).is_file():
            raise ValueError(f"来源文件缺失: {m_key}")
    m_actual = _inspect(m_imagePath)
    if "name" in m_asset and (not isinstance(m_asset["name"], str) or not m_asset["name"].strip()):
        raise ValueError("name 必须是非空素材名字")
    if "native_size_required" in m_asset and not isinstance(m_asset["native_size_required"], bool):
        raise ValueError("native_size_required 必须为布尔值")
    if "design_canvas" in m_asset:
        _size(m_asset["design_canvas"], "design_canvas")
        if "design_canvas" in m_manifest and m_asset["design_canvas"] != m_manifest["design_canvas"]:
            raise ValueError("资源与任务设计基准不一致")
    m_matchesDesign = None
    if "design_size" in m_asset:
        m_design = _size(m_asset["design_size"], "design_size")
        m_matchesDesign = (m_actual["width"], m_actual["height"]) == (m_design["width"], m_design["height"])
    if m_asset.get("native_size_required"):
        if not m_asset.get("name") or not m_asset.get("design_canvas") or not m_manifest.get("design_canvas") or not m_matchesDesign:
            raise ValueError("按设计原大小交付必须记录名称、设计基准，并使 PNG 实测尺寸等于 design_size")
    if m_actual["format"] != "PNG" or not m_actual["has_visible_pixels"]:
        raise ValueError("正式素材必须为包含可见像素的 PNG")
    if m_asset["requires_alpha"] and not m_actual["has_transparent_pixels"]:
        raise ValueError("需要透明背景，但没有透明像素")
    for m_key in ("format", "width", "height", "sha256"):
        if m_key in m_asset and m_asset[m_key] != m_actual[m_key]:
            raise ValueError(f"实测 {m_key} 不匹配")
    return {**m_asset, **m_actual, "size_matches_design": m_matchesDesign}


def _register(m_root, m_args):
    """先校验身份和图像，再独占复制并更新索引；更新失败撤回本次副本。"""
    # 1. 阻止重复身份和目标路径，避免替换已被其它任务引用的素材。
    m_data = _catalog(m_root)
    m_asset = _readJson(Path(m_args.metadata))
    m_destination = _resolve(m_root, m_asset["path"])
    for m_old in m_data["assets"]:
        if (m_old["id"], m_old["version"]) == (m_asset["id"], m_asset["version"]):
            raise ValueError("该资源版本已登记；请显式创建新版本")
        if _resolve(m_root, m_old["path"]) == m_destination:
            raise ValueError("目标路径已被索引引用")
    if m_destination.exists():
        raise ValueError("目标文件已存在，拒绝覆盖")
    m_asset = _validateAsset(m_root, m_data, m_asset, Path(m_args.source))
    # 2. 独占创建目标，复制失败时只撤回本次创建的文件。
    m_destination.parent.mkdir(parents=True, exist_ok=True)
    m_created = False
    try:
        with m_destination.open("xb") as m_target:
            m_created = True
            with Path(m_args.source).open("rb") as m_source:
                shutil.copyfileobj(m_source, m_target)
        # 3. 图片完整后原子保存索引，避免出现指向未写完图片的条目。
        m_data["assets"].append(m_asset)
        _writeJson(m_root / "catalog.json", m_data)
    except Exception:
        if m_created:
            m_destination.unlink(missing_ok=True)
        raise
    return {"registered": m_asset}


def _check(m_root):
    m_data = _catalog(m_root)
    m_errors, m_seen, m_paths = [], set(), set()
    for m_style in m_data["styles"]:
        try:
            _style(m_root, m_data, m_style["id"], m_style["version"])
        except (KeyError, ValueError) as m_error:
            m_errors.append(str(m_error))
    for m_asset in m_data["assets"]:
        try:
            m_key = (m_asset["id"], m_asset["version"])
            if m_key in m_seen or m_asset["path"] in m_paths:
                raise ValueError("重复资源身份或路径")
            m_seen.add(m_key)
            m_paths.add(m_asset["path"])
            _validateAsset(m_root, m_data, m_asset, _resolve(m_root, m_asset["path"]))
        except (OSError, KeyError, ValueError) as m_error:
            m_errors.append(f"{m_asset.get('id', '?')}: {m_error}")
    for m_file in sorted((m_root / "productions").glob("*/manifest.json")):
        try:
            m_manifest = _readJson(m_file)
            if "design_canvas" in m_manifest:
                _size(m_manifest["design_canvas"], "design_canvas")
            m_styleRef = m_manifest["style"]
            _style(m_root, m_data, m_styleRef["id"], m_styleRef["version"])
            m_taskKeys = {(m_a["id"], m_a["version"]) for m_a in m_manifest["assets"]}
            for m_key in m_taskKeys:
                if m_key not in m_seen:
                    raise ValueError(f"清单资源未登记: {m_key}")
                m_ref = next(m_a for m_a in m_data["assets"] if (m_a["id"], m_a["version"]) == m_key)
                if (m_ref["style_id"], m_ref["style_version"]) != (m_styleRef["id"], m_styleRef["version"]):
                    raise ValueError(f"组合任务混用了其它风格版本: {m_key}")
                if "design_canvas" in m_manifest and "design_canvas" in m_ref and m_ref["design_canvas"] != m_manifest["design_canvas"]:
                    raise ValueError("任务引用了不同设计基准的素材")
            for m_composition in m_manifest["compositions"]:
                for m_layer in m_composition["layers"]:
                    if (m_layer["asset_id"], m_layer["version"]) not in m_taskKeys:
                        raise ValueError("组合引用未列入任务清单的资源")
                    if not isinstance(m_layer["order"], int):
                        raise ValueError("组合层级必须为整数")
                    m_place = m_layer["placement"]
                    if any(not isinstance(m_place[m_k], (int, float)) for m_k in ("x", "y", "width", "height")):
                        raise ValueError("搭配位置必须为数值")
                    if m_place["width"] <= 0 or m_place["height"] <= 0:
                        raise ValueError("搭配尺寸必须为正数")
                    if m_manifest.get("preview_mode") == "native-design":
                        m_ref = next(m_a for m_a in m_data["assets"] if (m_a["id"], m_a["version"]) == (m_layer["asset_id"], m_layer["version"]))
                        if (m_place["width"], m_place["height"]) != (m_ref["width"], m_ref["height"]):
                            raise ValueError("原大小预览不得缩放单项 PNG")
        except (OSError, KeyError, TypeError, ValueError) as m_error:
            m_errors.append(f"{m_file.relative_to(m_root)}: {m_error}")
    return {"ok": not m_errors, "assets": len(m_data["assets"]), "styles": len(m_data["styles"]), "errors": m_errors}


def Main():
    """解析 CLI 并输出 JSON；无效输入和缺失文件返回退出码 1，不修改其它文件。"""
    m_parser = argparse.ArgumentParser(description=__doc__)
    m_sub = m_parser.add_subparsers(dest="command", required=True)
    for m_name in ("init", "find", "get", "register", "check"):
        m_command = m_sub.add_parser(m_name)
        m_command.add_argument("--root", required=True)
        if m_name == "find":
            m_command.add_argument("--style")
            m_command.add_argument("--purpose")
            m_command.add_argument("--tag", action="append", default=[])
        if m_name == "get":
            m_command.add_argument("--id", required=True)
            m_command.add_argument("--version", required=True)
        if m_name == "register":
            m_command.add_argument("--source", required=True)
            m_command.add_argument("--metadata", required=True)
    m_args = m_parser.parse_args()
    m_root = Path(m_args.root).resolve()
    try:
        if m_args.command == "init":
            m_root.mkdir(parents=True, exist_ok=True)
            if (m_root / "catalog.json").exists():
                raise ValueError("索引已存在，拒绝覆盖")
            _writeJson(m_root / "catalog.json", {"schema_version": 1, "styles": [], "assets": []})
            m_result = {"initialized": True}
        elif m_args.command == "register":
            m_result = _register(m_root, m_args)
        elif m_args.command == "check":
            m_result = _check(m_root)
        else:
            m_data = _catalog(m_root)
            m_assets = m_data["assets"]
            if m_args.command == "find":
                m_assets = [m_a for m_a in m_assets
                            if (not m_args.style or m_a["style_id"] == m_args.style)
                            and (not m_args.purpose or m_args.purpose in m_a["purpose"])
                            and all(m_t in m_a["tags"] for m_t in m_args.tag)]
            else:
                m_assets = [m_a for m_a in m_assets if m_a["id"] == m_args.id and m_a["version"] == m_args.version]
                if len(m_assets) != 1:
                    raise ValueError("资源版本缺失或重复")
                # 消费前实测文件，避免将已变化或缺失的 PNG 当成登记时仍合格的资源。
                m_assets = [_validateAsset(m_root, m_data, m_a, _resolve(m_root, m_a["path"])) for m_a in m_assets]
            m_result = {"inspection": "live-file" if m_args.command == "get" else "registered-metadata",
                        "assets": [{**m_a, "name": m_a.get("name", m_a["purpose"]), "style_path": _style(m_root, m_data, m_a["style_id"], m_a["style_version"])["path"]} for m_a in m_assets]}
        print(json.dumps(m_result, ensure_ascii=False, indent=2))
        return 1 if m_result.get("ok") is False else 0
    except (OSError, KeyError, TypeError, ValueError, ImportError) as m_error:
        print(json.dumps({"ok": False, "error": str(m_error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(Main())
