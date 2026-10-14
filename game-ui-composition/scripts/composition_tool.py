"""FGUI 组件盘点、映射核对、隔离准备与现有桥接调用；不渲染或生成 FUI。"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import struct
import xml.etree.ElementTree as ET


def _read(m_path):
    return json.loads(m_path.read_text(encoding='utf-8-sig'))


def _inside(m_root, m_relative):
    """解析相对路径；绝对路径或越界抛 ValueError，返回已解析非空 Path。"""
    if Path(m_relative).is_absolute():
        raise ValueError('路径必须相对工程')
    m_path = (m_root / m_relative).resolve()
    if not m_path.is_relative_to(m_root.resolve()):
        raise ValueError('路径越出隔离边界')
    return m_path


def _inventory(m_project):
    """只读盘点已登记资源和组件；XML 错误直接抛出，不猜测 ID。"""
    m_packages = []
    for m_file in sorted((m_project / 'assets').glob('*/package.xml')):
        m_xml = ET.parse(m_file).getroot()
        m_items = []
        for m_node in m_xml.findall('./resources/*'):
            m_item = dict(m_node.attrib, kind=m_node.tag)
            m_path = _inside(m_file.parent, str(Path(m_node.get('path', '/').strip('/')) / m_node.get('name', '')))
            if not m_path.is_file():
                raise ValueError(f'登记资源不存在：{m_path.name}')
            if m_node.tag == 'component':
                m_component = ET.parse(m_path).getroot()
                m_item.update(size=m_component.get('size'), extension=m_component.get('extention'),
                    nodes=[dict(m_child.attrib, kind=m_child.tag) for m_child in m_component.findall('./displayList/*')],
                    controllers=[dict(m_c.attrib, actions=[m_a.attrib for m_a in m_c.findall('action')]) for m_c in m_component.findall('controller')],
                    transitions=[m_t.attrib for m_t in m_component.findall('transition')])
            m_items.append(m_item)
        m_dependencies = set()
        for m_component_file in m_file.parent.rglob('*.xml'):
            m_text = m_component_file.read_text(encoding='utf-8-sig')
            m_dependencies.update(re.findall(r'\bpkg="([^"]+)"', m_text))
            m_dependencies.update(re.findall(r'ui://([a-zA-Z0-9]{8})', m_text))
        m_dependencies.discard(m_xml.get('id'))
        m_packages.append(dict(name=m_file.parent.name, id=m_xml.get('id'), dependencies=sorted(m_dependencies), resources=m_items))
    return m_packages


def _check_mapping(m_project, m_mapping):
    m_packages = {m_pkg['name']: m_pkg for m_pkg in _inventory(m_project)}
    m_errors = []
    m_instances = None
    if m_mapping.get('page_path'):
        m_page = ET.parse(_inside(m_project, m_mapping['page_path'])).getroot()
        m_instances = {m_node.get('name'): m_node for m_node in m_page.findall('./displayList/*')}
    for m_row in m_mapping['elements']:
        m_pkg = m_packages.get(m_row.get('package'))
        if not m_pkg:
            m_errors.append(f"未知包：{m_row['element']}")
            continue
        m_names = {m_item['name'].removesuffix('.xml') for m_item in m_pkg['resources'] if m_item['kind'] == 'component'}
        if m_row.get('component') not in m_names:
            m_errors.append(f"未知组件：{m_row['element']}")
        if not m_row.get('reason') or m_row.get('decision') not in ['reuse', 'extend', 'new']:
            m_errors.append(f"缺少复用决策：{m_row['element']}")
        m_rect = m_row.get('display_rect', [])
        if len(m_rect) != 4 or m_rect[2] <= 0 or m_rect[3] <= 0:
            m_errors.append(f"无效显示范围：{m_row['element']}")
        if m_row.get('asset_id') and (not m_row.get('version') or not m_row.get('native_size')):
            m_errors.append(f"素材版本/原尺寸缺少：{m_row['element']}")
        if m_instances is not None:
            for m_name in m_row.get('instances', [m_row.get('instance', '')]):
                m_node = m_instances.get(m_name.split('/')[0])
                if m_node is None:
                    m_errors.append(f'实例不存在：{m_name}')
                    continue
                m_resource = next((m_i for m_i in m_pkg['resources'] if m_i['name'] == m_row['component'] + '.xml'), None)
                if m_resource and m_node.get('src') != m_resource['id']:
                    m_errors.append(f'实例未复用所映射组件：{m_name}')
    return dict(ok=not m_errors, errors=m_errors, elements=len(m_mapping['elements']), visual_verified=False)


def _prepare(m_project, m_destination, m_names):
    """复制递归依赖到新目录；拒绝已有目标与漏依赖，防止覆盖用户工程。"""
    # 1. 先解析依赖，任何错误均在创建目标之前报告。
    m_packages = _inventory(m_project)
    m_by_name = {m_pkg['name']: m_pkg for m_pkg in m_packages}
    m_by_id = {m_pkg['id']: m_pkg for m_pkg in m_packages}
    m_selected = set()
    def _visit(m_name):
        if m_name in m_selected:
            return
        m_pkg = m_by_name[m_name]
        m_selected.add(m_name)
        for m_id in m_pkg['dependencies']:
            if m_id not in m_by_id:
                raise ValueError(f'未知依赖 {m_id}')
            _visit(m_by_id[m_id]['name'])
    for m_name in m_names:
        _visit(m_name)
    m_settings = _read(m_project / 'settings/Publish.json')
    for m_font in m_settings.get('sceFontExport', {}).get('fonts', []):
        _inside(m_project, m_font['source'])
        _inside(Path('/isolated'), m_font['runtimePath'])
    if m_destination.exists():
        raise ValueError('隔离目录已存在，选择新目录')
    # 2. 创建拥有独立父边界的工程，全部输出留在这个边界内。
    m_target = m_destination / 'FGUIProject'
    m_target.mkdir(parents=True)
    m_fairy = next(m_project.glob('*.fairy'))
    shutil.copy2(m_fairy, m_target / m_fairy.name)
    for m_name in sorted(m_selected):
        shutil.copytree(m_project / 'assets' / m_name, m_target / 'assets' / m_name)
    for m_dir in ['fonts', 'settings', 'plugins']:
        if (m_project / m_dir).exists():
            shutil.copytree(m_project / m_dir, m_target / m_dir,
                ignore=shutil.ignore_patterns('bridge', '__pycache__', 'unitTest', 'tests', '.objs'))
    m_settings['path'] = '../ui/AppBundle/user_files/fgui'
    m_settings.setdefault('codeGeneration', {}).update(allowGenCode=False, codePath='../disabled-code')
    m_settings.setdefault('sceCodeGeneration', {}).update(enabled=False, codePath='../disabled-code')
    (m_target / 'settings/Publish.json').write_text(json.dumps(m_settings, ensure_ascii=False, indent=2), encoding='utf-8')
    return dict(project=str(m_target), packages=sorted(m_selected), exported=False)


def _export_check(m_project):
    """检查真实文件和哈希；缺少产物即失败，不能证明视觉或动画合格。"""
    m_settings = _read(m_project / 'settings/Publish.json')
    if m_settings.get('codeGeneration', {}).get('allowGenCode') is not False or m_settings.get('sceCodeGeneration', {}).get('enabled') is not False:
        raise ValueError('代码生成未全部关闭')
    m_boundary = m_project.parent.resolve()
    m_directory = _inside(m_boundary, str(Path(m_project.name) / m_settings['path']))
    m_manifest = _read(m_directory / 'FguiPackageManifest.json')
    m_expected = {m_pkg['id']: m_pkg['name'] for m_pkg in _inventory(m_project)}
    m_actual = {m_entry['id']: m_entry['name'] for m_entry in m_manifest['packages']}
    if not m_expected or m_expected != m_actual or len(m_manifest['packages']) != len(m_actual):
        raise ValueError('导出包清单与隔离源工程不一致')
    m_files = []
    for m_entry in m_manifest['packages']:
        m_file = _inside(m_directory, m_entry['file'])
        m_bytes = m_file.read_bytes()
        if m_bytes[:4] != b'FGUI' or len(m_bytes) < 12 or struct.unpack_from('>i', m_bytes, 4)[0] < 2 or m_bytes[8] != 0:
            raise ValueError('无效 FGUI 包头')
        m_offset = 9
        m_strings = []
        for m_index in range(2):
            m_length = struct.unpack_from('>H', m_bytes, m_offset)[0]
            m_offset += 2
            m_strings.append(m_bytes[m_offset:m_offset+m_length].decode('utf-8'))
            m_offset += m_length
        if m_strings != [m_entry['id'], m_entry['name']] or hashlib.sha256(m_bytes).hexdigest() != m_entry['sha256']:
            raise ValueError('包标识或哈希不符')
        m_files.append(str(m_file.relative_to(m_boundary)))
        for m_dependency in m_entry.get('dependencies', []):
            if m_actual.get(m_dependency['id']) != m_dependency['name']:
                raise ValueError('导出清单缺少跨包依赖')
    for m_name in ['FguiTextManifest.json', 'FguiButtonManifest.json', 'FguiFontManifest.json']:
        _read(m_directory / m_name)
        m_files.append(str((m_directory / m_name).relative_to(m_boundary)))
    for m_font in _read(m_directory / 'FguiFontManifest.json')['fonts']:
        m_file = _inside(m_directory.parent, m_font['path'])
        if not m_file.is_file() or m_file.stat().st_size == 0:
            raise ValueError('字体导出缺少')
        m_source_font = next((m_f for m_f in m_settings.get('sceFontExport', {}).get('fonts', []) if m_f['name'] == m_font['name']), None)
        if not m_source_font or m_file.read_bytes() != _inside(m_project, m_source_font['source']).read_bytes():
            raise ValueError('字体源与导出字体不一致')
        m_files.append(str(m_file.relative_to(m_boundary)))
    m_atlas_directory = m_boundary / 'ui/image/fgui'
    m_atlas_manifest = _read(m_atlas_directory / '.fgui-atlas-export-manifest.json')
    if not m_atlas_manifest['files']:
        raise ValueError('图集清单为空')
    for m_name in m_atlas_manifest['files']:
        m_file = _inside(m_atlas_directory, m_name)
        if not m_file.is_file() or m_file.stat().st_size < 20:
            raise ValueError('图集缺少')
        if m_file.read_bytes()[:8] != b'\x89PNG\r\n\x1a\n':
            raise ValueError('图集不是实际 PNG')
        m_files.append(str(m_file.relative_to(m_boundary)))
    if list((m_boundary / 'ui').rglob('*.cs')) or (m_boundary / 'disabled-code').exists():
        raise ValueError('隔离目录出现生成代码')
    return dict(ok=True, files=m_files, packages=len(m_manifest['packages']), visual_verified=False)


def Main():
    """命令行入口；参数缺失由 argparse 报告，文件/校验错误以 JSON 返回并非零退出。"""
    m_parser = argparse.ArgumentParser(description=__doc__)
    m_parser.add_argument('command', choices=['inspect', 'check-mapping', 'prepare-export', 'install-bridge-adapter', 'bridge', 'check-export'])
    m_parser.add_argument('--project', type=Path, required=True)
    m_parser.add_argument('--mapping', type=Path)
    m_parser.add_argument('--destination', type=Path)
    m_parser.add_argument('--packages', nargs='+')
    m_parser.add_argument('--queue-module', type=Path)
    m_parser.add_argument('--action')
    m_parser.add_argument('--params', default='{}')
    m_args = m_parser.parse_args()
    try:
        m_project = m_args.project.resolve()
        if m_args.command == 'inspect':
            m_result = _inventory(m_project)
        elif m_args.command == 'check-mapping':
            m_result = _check_mapping(m_project, _read(m_args.mapping))
        elif m_args.command == 'prepare-export':
            m_result = _prepare(m_project, m_args.destination.resolve(), m_args.packages)
        elif m_args.command == 'check-export':
            m_result = _export_check(m_project)
        elif m_args.command == 'install-bridge-adapter':
            m_file = m_project / 'plugins/MCPBridge/src/command_handler.lua'
            m_source = m_file.read_text(encoding='utf-8-sig')
            m_main = (m_project / 'plugins/MCPBridge/main.lua').read_text(encoding='utf-8-sig')
            if 'local handlers = {' not in m_source or 'reload_signal' not in m_main:
                raise ValueError('桥接版本不匹配；先查阅源代码')
            m_settings = _read(m_project / 'settings/Publish.json')
            if m_settings.get('sceCodeGeneration', {}).get('enabled') is not False or m_settings.get('codeGeneration', {}).get('allowGenCode') is not False:
                raise ValueError('适配仅安装到关闭代码生成的独立工程')
            if '["composition_import"]' not in m_source:
                m_extension = (Path(__file__).resolve().parents[1] / 'assets/bridge-actions.lua.txt').read_text(encoding='utf-8')
                m_file.write_text(m_source.replace('local handlers = {', 'local handlers = {\n' + m_extension, 1), encoding='utf-8')
            (m_project / 'plugins/MCPBridge/bridge').mkdir(exist_ok=True)
            (m_project / 'plugins/MCPBridge/bridge/reload_signal').write_text('', encoding='utf-8')
            m_result = dict(installed=True, actions=['composition_import', 'composition_import_status', 'composition_move'])
        else:
            m_allowed = {'list_packages', 'list_components', 'get_component_info', 'create_component', 'composition_import', 'composition_import_status', 'composition_move', 'reload', 'open_component', 'save', 'close', 'start_test', 'stop_test', 'capture_preview', 'list_controllers', 'switch_controller', 'select_element', 'probe_plugin_api', 'probe_publish', 'publish_package', 'publish_all'}
            if m_args.action not in m_allowed:
                raise ValueError('不支持的桥接动作，先查实际协议')
            if m_args.action.startswith('publish'):
                m_settings = _read(m_project / 'settings/Publish.json')
                if m_settings.get('codeGeneration', {}).get('allowGenCode') is not False or m_settings.get('sceCodeGeneration', {}).get('enabled') is not False:
                    raise ValueError('发布前关闭两处代码生成')
                _inside(m_project.parent, str(Path(m_project.name) / m_settings['path']))
            m_spec = importlib.util.spec_from_file_location('existing_queue', m_args.queue_module)
            m_module = importlib.util.module_from_spec(m_spec)
            m_spec.loader.exec_module(m_module)
            m_result = m_module.CommandQueue(m_project / 'plugins/MCPBridge/bridge').send_command(m_args.action, json.loads(m_args.params), timeout_ms=20000)
        print(json.dumps(m_result, ensure_ascii=False, indent=2))
        if isinstance(m_result, dict) and (m_result.get('ok') is False or m_result.get('status') == 'error'):
            raise SystemExit(1)
    except (ValueError, KeyError, OSError, ET.ParseError, TypeError, StopIteration, struct.error) as m_error:
        print(json.dumps(dict(ok=False, error=str(m_error)), ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    Main()
