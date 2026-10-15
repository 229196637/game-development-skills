/** 创建独立浏览缩略图和资料卡；原图只读，缩略图不能用于制作验收。 */
const m_fs = require('node:fs/promises');
const m_path = require('node:path');
const m_crypto = require('node:crypto');
const m_sharp = require('sharp');

function _hash(m_bytes) { return m_crypto.createHash('sha256').update(m_bytes).digest('hex'); }
function _html(m_text) { return String(m_text).replace(/[&<>"']/g, m_char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m_char])); }
function _size(m_bytes) { return m_bytes >= 1048576 ? `${(m_bytes / 1048576).toFixed(2)} MiB` : `${(m_bytes / 1024).toFixed(1)} KiB`; }
function _url(m_relative) { return m_relative.split('/').map(encodeURIComponent).join('/'); }

async function _inside(m_root, m_relative) {
  // 原图和输出路径均限制在库内，防止定位写错或符号链接把缩略图写到库外。
  if (typeof m_relative !== 'string' || !m_relative || m_relative.includes('\\') || m_relative.includes(':') || m_relative.split('/').includes('..') || m_path.isAbsolute(m_relative)) throw Error('必须使用库内POSIX相对路径');
  const m_target = m_path.resolve(m_root, m_relative);
  if (!m_target.startsWith(m_root + m_path.sep)) throw Error('路径必须位于库根以内');
  let m_existing = m_target;
  while (true) {
    try { await m_fs.lstat(m_existing); break; }
    catch (m_error) { if (m_error.code !== 'ENOENT') throw m_error; m_existing = m_path.dirname(m_existing); }
  }
  const m_real = await m_fs.realpath(m_existing);
  if (m_real !== m_root && !m_real.startsWith(m_root + m_path.sep)) throw Error('符号链接指向库外');
  return m_target;
}

async function _walk(m_root, m_directory, m_output, m_result = []) {
  for (const m_entry of await m_fs.readdir(m_directory, {withFileTypes:true})) {
    const m_absolute = m_path.join(m_directory, m_entry.name);
    if (m_absolute === m_output || m_entry.name === '.git' || m_entry.isSymbolicLink()) continue;
    if (m_entry.isDirectory()) await _walk(m_root, m_absolute, m_output, m_result);
    else if (m_entry.isFile()) m_result.push(m_path.relative(m_root, m_absolute).split(m_path.sep).join('/'));
  }
  return m_result.sort();
}

async function _writeDerived(m_root, m_relative, m_text) {
  const m_target = await _inside(m_root,m_relative);
  const m_stat = await m_fs.lstat(m_target).catch(m_error => { if (m_error.code === 'ENOENT') return null; throw m_error; });
  if (m_stat && (m_stat.isSymbolicLink() || !m_stat.isFile())) throw Error('派生索引不能覆盖符号链接或目录');
  await m_fs.writeFile(m_target,m_text);
}

async function _labels(m_root, m_files) {
  const m_names = new Map();
  function _visit(m_node) {
    if (!m_node || typeof m_node !== 'object') return;
    if (!Array.isArray(m_node)) {
      const m_file = m_node.path || m_node.reference;
      if (typeof m_file === 'string' && typeof m_node.name === 'string' && m_node.name.trim()) m_names.set(m_file, {name:m_node.name, id:m_node.id || null, design_size:m_node.design_size || null});
    }
    for (const m_value of Object.values(m_node)) if (m_value && typeof m_value === 'object') _visit(m_value);
  }
  for (const m_file of m_files.filter(m_value => m_value.endsWith('.json'))) {
    _visit(JSON.parse((await m_fs.readFile(await _inside(m_root, m_file), 'utf8')).replace(/^\uFEFF/, '')));
  }
  return m_names;
}


/** 读取显式分类；新增图片进入待整理，不从文件名推断用户认可。 */
async function _organization(m_root, m_images) {
  const m_data = await m_fs.readFile(m_path.join(m_root,'organization.json'),'utf8').catch(m_error => { if (m_error.code === 'ENOENT') return null; throw m_error; });
  if (m_data === null) return new Map();
  const m_record = JSON.parse(m_data.replace(/^\uFEFF/,''));
  if (m_record.schema_version !== 1 || !Array.isArray(m_record.images)) throw Error('图片分类格式错误');
  const m_map = new Map();
  for (const m_item of m_record.images) {
    if (!m_images.includes(m_item.path) || m_map.has(m_item.path) || !['approved','retained','concept','background','repair','rejected','history'].includes(m_item.group) || !m_item.name || !m_item.note || m_item.runtime_ready !== false) throw Error('图片分类路径、状态或说明错误；正式交付请使用handoff');
    m_map.set(m_item.path,{group:m_item.group,name:m_item.name,note:m_item.note,runtime_ready:false});
  }
  return m_map;
}

function _page(m_records, m_outputRelative) {
  function _cards(m_items) { return m_items.map(m_item => {
    const m_original = _url(m_path.posix.relative(m_outputRelative, m_item.path));
    const m_thumb = _url(m_path.posix.relative(m_outputRelative, m_item.thumbnail.path));
    const m_design = m_item.design_size;
    const m_target = ['approved','retained','concept','rejected','history'].includes(m_item.group) ? '整图参考／历史资料：不是独立控件，不按控件目标尺寸验收。' : m_design ? `设计目标 ${_html(m_design.width)}×${_html(m_design.height)} · ${m_item.width === m_design.width && m_item.height === m_design.height ? '像素尺寸匹配（仍需正式handoff）' : '未匹配，不能作为正式尺寸交付'}` : '未记录正式素材目标尺寸，不能仅凭原图或缩略图认定可交付';
    return `<article><a href="${m_original}"><img loading="lazy" width="${m_item.thumbnail.width}" height="${m_item.thumbnail.height}" src="${m_thumb}" alt="${_html(m_item.name)}"></a><h2>${_html(m_item.name)}</h2><p class="notice">${_html(m_item.note || "未分类，尚未验收")}</p><p>资源文件：<code>${_html(m_path.posix.basename(m_item.path))}</code></p><p>原图 ${m_item.width}×${m_item.height} · ${_size(m_item.bytes)}</p><p>缩略图 ${m_item.thumbnail.width}×${m_item.thumbnail.height} · ${_size(m_item.thumbnail.bytes)} · WebP</p><p>${m_target}</p><p class="path">${_html(m_item.path)}</p><a href="${m_original}">查看原图</a> · <a href="${m_thumb}">缩略图文件</a></article>`;
  }).join('\n'); }
  const m_groups = [['approved','当前认可参考'],['retained','关闭按钮三版保留'],['concept','新生成效果图 · 未拆分'],['background','独立背景 · 待交付'],['repair','待修正 · 禁止直接使用'],['rejected','未采用方案'],['history','历史资料'],['unreviewed','待整理']];
  const m_cards = m_groups.map(([m_key,m_title]) => {
    const m_items = m_records.filter(m_item => (m_item.group || 'unreviewed') === m_key);
    if (!m_items.length) return '';
    const m_body = `<div class="grid">${_cards(m_items)}</div>`;
    return ['repair','rejected','history'].includes(m_key) ? `<details id="${m_key}"><summary>${m_title}（${m_items.length}）</summary>${m_body}</details>` : `<section id="${m_key}"><h2>${m_title}（${m_items.length}）</h2>${m_body}</section>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>美术资源分类预览</title><style>body{margin:0;background:#f4f1ea;color:#34413c;font:16px/1.6 "Microsoft YaHei",sans-serif}main{max-width:1500px;margin:auto;padding:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}article{background:white;padding:16px;border:1px solid #ddd;min-width:0}img{display:block;width:100%;height:230px;object-fit:contain;background:#e7e5df}h2{font-size:18px;margin:12px 0 6px}p{font-size:13px;margin:4px 0;overflow-wrap:anywhere}.path{color:#6d766e}a{color:#286d62}section,details{margin:28px 0}summary{cursor:pointer;font-size:20px;font-weight:bold;padding:12px;background:#e4ded0}.notice{color:#87432d}nav a{display:inline-block;margin:4px 14px 4px 0}</style><main><h1>美术资源分类预览</h1><p>${m_records.length}张图片。卡片加载独立缩略图；点击查看原图。像素尺寸与文件体积分别记录，缩略图不作为正式素材或尺寸验收依据。</p><p>正式素材请经过handoff检查；本页参考、草稿及背景不会自动成为可用控件。旧稿折叠保留，原图未修改。</p><nav><a href="#approved">认可参考</a><a href="#retained">关闭按钮</a><a href="#concept">新效果图</a><a href="#background">独立背景</a><a href="#repair">待修正</a><a href="#rejected">未采用</a><a href="#history">历史</a></nav>${m_cards}</main></html>\n`;
}

async function _build(m_root, m_outputRelative, m_maxEdge) {
  // 1. 在写输出前完成源文件与名称收集；排除生成目录以免递归缩略图。
  const m_output = await _inside(m_root, m_outputRelative);
  // 只维护本工具拥有的输出目录，避免把生产目录的manifest/index当派生文件覆盖。
  const m_marker = m_path.join(m_output,'.preview-tool.json');
  try {
    const m_entries = await m_fs.readdir(m_output);
    if (m_entries.length) {
      const m_owner = JSON.parse(await m_fs.readFile(m_marker,'utf8'));
      if (m_owner.generator !== 'game-layered-art.preview_tool/v1') throw Error('输出目录不是本工具创建的缩略图库');
    }
  } catch (m_error) {
    if (m_error.code !== 'ENOENT') throw m_error;
    const m_stat = await m_fs.stat(m_output).catch(() => null);
    if (m_stat) throw Error('非空输出目录缺少工具标识，拒绝覆盖');
  }
  const m_files = await _walk(m_root, m_root, m_output);
  const m_labels = await _labels(m_root, m_files);
  const m_images = m_files.filter(m_file => /\.(png|jpe?g|webp)$/i.test(m_file));
  const m_organization = await _organization(m_root,m_images);
  await m_fs.mkdir(m_output,{recursive:true});
  await _writeDerived(m_root,`${m_outputRelative}/.preview-tool.json`,JSON.stringify({generator:'game-layered-art.preview_tool/v1'})+'\n');
  const m_records = [];
  for (const m_file of m_images) {
    const m_source = await _inside(m_root, m_file);
    const m_bytes = await m_fs.readFile(m_source);
    const m_meta = await m_sharp(m_bytes).metadata();
    if ((m_meta.pages || 1) > 1) throw Error(`动画图片请单独指定静态预览：${m_file}`);
    // 2. 仅创建派生图：保持比例、不裁切、不放大；WebP保留透明区域。
    const m_result = await m_sharp(m_bytes).resize({width:m_maxEdge,height:m_maxEdge,fit:'inside',withoutEnlargement:true}).webp({quality:82,alphaQuality:100}).toBuffer({resolveWithObject:true});
    const m_sha = _hash(m_bytes);
    const m_thumbRelative = `${m_outputRelative}/thumbnails/${m_sha.slice(0,24)}-${m_maxEdge}-q82.webp`;
    const m_target = await _inside(m_root, m_thumbRelative);
    await m_fs.mkdir(m_path.dirname(m_target), {recursive:true});
    try {
      await m_fs.writeFile(m_target, m_result.data, {flag:'wx'});
    } catch (m_error) {
      if (m_error.code !== 'EEXIST') throw m_error;
      if (_hash(await m_fs.readFile(m_target)) !== _hash(m_result.data)) throw Error(`已存在不同缩略图，拒绝覆盖：${m_thumbRelative}`);
    }
    // 原图未作为输出打开；额外核对摘要，防止外部并发修改导致索引与原件不符。
    if (_hash(await m_fs.readFile(m_source)) !== m_sha) throw Error(`制作预览时原图发生变化：${m_file}`);
    const m_label = m_labels.get(m_file) || {};
    const m_classification = m_organization.get(m_file) || {group:'unreviewed',note:'未分类，尚未验收',runtime_ready:false};
    m_records.push({...m_classification,name:m_classification.name || m_label.name || m_path.posix.basename(m_file),id:m_label.id || null,path:m_file,width:m_meta.width,height:m_meta.height,bytes:m_bytes.length,sha256:m_sha,design_size:m_label.design_size || null,thumbnail:{path:m_thumbRelative,width:m_result.info.width,height:m_result.info.height,bytes:m_result.data.length,format:'webp',sha256:_hash(m_result.data)}});
  }
  // 3. 最后写独立预览索引与资料卡，不改catalog、定稿或原图。
  const m_index = {schema_version:1,generator:'game-layered-art.preview_tool/v1',max_edge:m_maxEdge,source_images:m_records.length,thumbnail_policy:'inside-no-crop-no-upscale-preview-only',images:m_records};
  await _writeDerived(m_root,`${m_outputRelative}/manifest.json`,JSON.stringify(m_index,null,2)+'\n');
  await _writeDerived(m_root,`${m_outputRelative}/index.html`,_page(m_records,m_outputRelative));
  return {ok:true,images:m_records.length,index:`${m_outputRelative}/index.html`,manifest:`${m_outputRelative}/manifest.json`,originals_unchanged:true};
}

async function _check(m_root, m_outputRelative) {
  const m_manifest = JSON.parse(await m_fs.readFile(await _inside(m_root, `${m_outputRelative}/manifest.json`),'utf8'));
  if (m_manifest.schema_version !== 1 || m_manifest.generator !== 'game-layered-art.preview_tool/v1' || !Number.isInteger(m_manifest.max_edge) || m_manifest.max_edge <= 0 || !Array.isArray(m_manifest.images) || m_manifest.source_images !== m_manifest.images.length) throw Error('预览索引格式错误');
  const m_seen = new Set();
  for (const m_item of m_manifest.images) {
    if (!m_item.name || m_seen.has(m_item.path)) throw Error('名称为空或原图条目重复');
    m_seen.add(m_item.path);
    for (const m_value of [m_item,m_item.thumbnail]) {
      const m_data = await m_fs.readFile(await _inside(m_root,m_value.path));
      const m_meta = await m_sharp(m_data).metadata();
      if (m_data.length !== m_value.bytes || _hash(m_data) !== m_value.sha256 || m_meta.width !== m_value.width || m_meta.height !== m_value.height) throw Error(`文件与预览索引不符：${m_value.path}`);
    }
    const m_thumb = m_item.thumbnail;
    if (!m_thumb.path.startsWith(`${m_outputRelative}/thumbnails/`) || Math.max(m_thumb.width,m_thumb.height) > m_manifest.max_edge || m_thumb.width > m_item.width || m_thumb.height > m_item.height || Math.abs(m_thumb.width/m_thumb.height-m_item.width/m_item.height) > 2/Math.min(m_thumb.height,m_item.height)) throw Error(`缩略图位置、比例或大小无效：${m_item.path}`);
  }
  const m_files = await _walk(m_root,m_root,await _inside(m_root,m_outputRelative));
  const m_images = m_files.filter(m_file => /\.(png|jpe?g|webp)$/i.test(m_file));
  if (m_images.length !== m_seen.size || m_images.some(m_file => !m_seen.has(m_file))) throw Error('图片清单已变化，需要重新build缩略图');
  const m_organization = await _organization(m_root,m_images);
  for (const m_item of m_manifest.images) {
    const m_classification = m_organization.get(m_item.path) || {group:'unreviewed',note:'未分类，尚未验收',runtime_ready:false};
    if (Object.entries(m_classification).some(([m_key,m_value]) => m_item[m_key] !== m_value)) throw Error('分类记录变化，需要重新build');
  }
  const m_page = await m_fs.readFile(await _inside(m_root, `${m_outputRelative}/index.html`),'utf8');
  if (m_page !== _page(m_manifest.images,m_outputRelative)) throw Error('预览页面与名称、原图/缩略图信息不一致');
  return {ok:true,images:m_seen.size,checks:'原图与缩略图尺寸/字节/摘要、等比不放大、全量覆盖和页面资料卡',read_only:true};
}

async function Main() {
  const m_args = process.argv.slice(2);
  const m_command = m_args.shift();
  const m_options = {};
  while (m_args.length) {
    const m_key = m_args.shift(), m_value = m_args.shift();
    if (!['--root','--output','--max-edge'].includes(m_key) || !m_value || m_options[m_key]) throw Error('用法：preview_tool.cjs build|check --root <库根> [--output previews] [--max-edge 640]');
    m_options[m_key] = m_value;
  }
  if (!['build','check'].includes(m_command) || !m_options['--root']) throw Error('需要build/check及--root');
  if (m_command === 'check' && m_options['--max-edge']) throw Error('check使用索引记录的max_edge，不接受--max-edge');
  const m_root = await m_fs.realpath(m_options['--root']);
  const m_output = m_options['--output'] || 'previews';
  const m_edge = Number(m_options['--max-edge'] || 640);
  if (!Number.isInteger(m_edge) || m_edge < 1 || m_edge > 4096) throw Error('max-edge必须为1–4096整数');
  const m_result = m_command === 'build' ? await _build(m_root,m_output,m_edge) : await _check(m_root,m_output);
  process.stdout.write(JSON.stringify(m_result)+'\n');
}

Main().catch(m_error => { process.stdout.write(JSON.stringify({ok:false,errors:[m_error.message]})+'\n'); process.exitCode=1; });
