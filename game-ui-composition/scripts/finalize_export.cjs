// FairyGUI 6 的 Puerts 不含 Node fs。由真实发布后外部 Node 调用现有资源导出函数。
// 参数为隔离工程路径、现有 CSharpUiBindingExporter/main.js、inspect 输出 JSON。
// 无效路径、未关闭代码生成、缺少真实 FUI 均抛错；不生成 FUI 或绑定代码。
const m_fs = require('fs');
const m_path = require('path');
const [m_project, m_exporter, m_inventory] = process.argv.slice(2).map(m_value => m_path.resolve(m_value));
const m_settings = JSON.parse(m_fs.readFileSync(m_path.join(m_project, 'settings/Publish.json'), 'utf8'));
if (m_settings.codeGeneration?.allowGenCode !== false || m_settings.sceCodeGeneration?.enabled !== false)
    throw new Error('必须关闭两处代码生成');
const m_boundary = m_path.dirname(m_project);
const m_output = m_path.resolve(m_project, m_settings.path);
if (m_path.isAbsolute(m_settings.path) || !m_output.startsWith(m_boundary + m_path.sep))
    throw new Error('输出必须留在隔离边界内');
const m_packages = JSON.parse(m_fs.readFileSync(m_inventory, 'utf8')).map(m_pkg => ({name:m_pkg.name, id:m_pkg.id}));
const m_plugin = require(m_exporter);
const m_resolved = m_plugin.attachPackageDependencies(m_packages, m_project);
// 先核对真实 FUI 的标识和哈希，失败时不宣布清单完成。
const m_result = {packages: m_plugin.publishPackageManifest(m_resolved, m_project)};
m_result.atlas = m_plugin.publishAtlasImages(m_resolved, m_project);
m_result.font = m_plugin.publishFonts(m_project);
m_result.text = m_plugin.publishTextManifest(m_resolved, m_project);
m_result.button = m_plugin.publishButtonManifest(m_resolved, m_project);
console.log(JSON.stringify(m_result, null, 2));
