const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { patch, sha } = require('./patch.cjs');
function entry(archive, name) {
  const a = fs.readFileSync(archive), h = JSON.parse(a.subarray(16, 16 + a.readUInt32LE(12)));
  let e = h; for (const k of name.split('/')) e = e.files[k];
  const start = 8 + a.readUInt32LE(4) + Number(e.offset);
  return a.subarray(start, start + e.size).toString('utf8');
}
function glassCss(source) {
  const start = source.indexOf('const READABILITY_FLOOR =');
  const end = source.indexOf('`;', source.indexOf('const CSS_GLASS =', start)) + 2;
  return vm.runInNewContext(source.slice(start, end) + ';CSS_GLASS');
}
function cssValue(source, pattern) {
  const value = source.match(pattern); assert.ok(value, 'production CSS anchor exists');
  return JSON.parse(value[1]);
}
test('production styles: contrast, hover, theme, stale cyan, gates and exclusions', async () => {
  const profile = process.env.DSH_PATCH_PROFILE, archive = process.env.DSH_PATCH_APP_ASAR;
  assert.ok(profile && archive, 'Set DSH_PATCH_PROFILE and DSH_PATCH_APP_ASAR to read-only fixture sources');
  const glass = fs.readFileSync(process.env.DSH_PATCH_GLASS_CLIENT || path.join(profile, 'node_modules/dsh-plugin-wallpaper-engine-glass/lib/client.glass.js'), 'utf8');
  assert.equal(sha(Buffer.from(glass)), require('./provenance.json').originalSha256);
  const theme = cssValue(entry(archive, 'node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'), /var design_platform_css_default = ("(?:[^"\\]|\\.)*");/);
  const chat = entry(archive, 'node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js');
  const statStart = chat.indexOf('stat-dialog.module.css.mjs');
  const stat = cssValue(chat.slice(statStart), /const css\$\d+ = ("(?:[^"\\]|\\.)*");/);
  const statPrefix = stat.match(/\.([\w-]+)_panel/)[1];
  const agency = fs.readFileSync(path.join(profile, 'node_modules/@michengai/dsh-agency-agents/lib/client.js'), 'utf8');
  const agencyRules = [...agency.matchAll(/([^{};`\n]{1,240})\{([^{}]{0,2400})\}/g)]
    .filter(m => /^\s*\.aag-(menu|discovery)/.test(m[1])).map(m => m[1] + '{' + m[2] + '}').join('\n');
  assert.ok(agencyRules.includes('.aag-menu{'));
  const browser = await require('playwright').chromium.launch({ headless: true, ...(process.env.DSH_PATCH_BROWSER_CHANNEL ? { channel: process.env.DSH_PATCH_BROWSER_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
    const html = `<main id="page">普通正文<span id="outside-muted" style="color:var(--dsw-alias-label-tertiary)">自定义青色</span></main>
      <div id="expert" class="aag-menu aag-discovery" style="position:absolute;top:60px;left:30px;bottom:auto"><div>专家　　专家团</div><input placeholder="搜索名称、领域或关键词"><div class="aag-menu-title">设计</div><button class="aag-menu-item aag-discovery-row">UI 设计师</button></div>
      <div id="stats" role="dialog" class="${statPrefix}_panel" style="top:60px;left:430px"><div class="${statPrefix}_title">Token 用量 <span>12,135,459 tok</span></div><div class="${statPrefix}_titleRule"></div><dl class="${statPrefix}_details"><dt>缓存命中</dt><dd>95%</dd><dt>未缓存输入</dt><dd>636,043 tok</dd><dt>缓存读取</dt><dd>11,455,616 tok</dd><dt>输出</dt><dd>43,800 tok</dd></dl></div>
      <div id="tooltip" role="tooltip" style="position:absolute;top:310px;left:30px;color:white">原生提示 <small style="color:var(--dsw-alias-label-caption)">说明文字</small></div>
      <div id="menu" role="menu" style="position:absolute;top:310px;left:430px">菜单<span style="color:var(--dsw-alias-label-tertiary)">说明</span></div>
      <div id="host" role="dialog" data-we-host-dialog style="background:rgb(1,2,3);position:absolute;top:400px">宿主设置窗</div>
      <div id="carrier" role="dialog" data-we-surface-runtime="settings-window" style="background:rgb(4,5,6);position:absolute;top:440px">玻璃载体</div>`;
    let checked = 0;
    for (const dark of [false, true]) for (const tint of ['#63d6e0', '#202630']) for (const wallpaper of ['#ffffff', '#000000']) {
      const vars = `--we-surface-tint-light:${tint};--we-surface-tint-dark:${tint};--we-panel-color:${dark ? '#1e1f26' : '#fff'};--we-glass-alpha:.15;--we-glass-fidelity:0;--dsw-alias-label-secondary:#fafafa;--dsw-alias-label-tertiary:#75e6f5;--dsw-alias-label-caption:#2de8eb;`;
      await page.setContent(`<style>${theme}\n${glassCss(patch(glass))}\n${stat}\n${agencyRules}\nbody{font-family:Arial,sans-serif;background:${wallpaper}}input{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}input::placeholder{color:var(--dsw-alias-label-tertiary)}</style><body data-we-glass-page data-we-floater-solid ${dark ? 'data-ds-dark-theme' : ''} style="${vars}">${html}</body>`);
      const readings = await page.evaluate(() => {
        const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
        const lum = c => c.slice(0,3).map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((s,v,i) => s+v*[.2126,.7152,.0722][i],0);
        const contrast = (f,b) => { const a=lum(f), c=lum(b); return (Math.max(a,c)+.05)/(Math.min(a,c)+.05); };
        return ['expert','stats','tooltip','menu'].map(id => {
          const el=document.getElementById(id), s=getComputedStyle(el), bg=rgb(s.backgroundColor);
          const values=[el,...el.querySelectorAll('*')].map(n => contrast(rgb(getComputedStyle(n).color),bg));
          return {id, alpha:bg[3]??1, image:s.backgroundImage, min:Math.min(...values)};
        });
      });
      for (const r of readings) { assert.equal(r.alpha,1); assert.equal(r.image,'none'); assert.ok(r.min>=4.5, JSON.stringify({dark,tint,wallpaper,...r})); checked++; }
      await page.locator('.aag-discovery-row').hover();
      const hover = await page.locator('.aag-discovery-row').evaluate(el => ({bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color}));
      assert.notEqual(hover.bg,'rgba(0, 0, 0, 0)');
      const luminance = s => s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const a=luminance(hover.bg),b=luminance(hover.fg);
      assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'hover text contrast');
      assert.equal(await page.locator('#outside-muted').evaluate(el => getComputedStyle(el).color),'rgb(117, 230, 245)');
      assert.equal(await page.locator('#host').evaluate(el => getComputedStyle(el).backgroundColor),'rgb(1, 2, 3)');
      assert.equal(await page.locator('#carrier').evaluate(el => getComputedStyle(el).backgroundColor),'rgb(4, 5, 6)');
      if (process.env.DSH_PATCH_SCREENSHOTS && tint==='#202630' && wallpaper==='#000000') {
        fs.mkdirSync(process.env.DSH_PATCH_SCREENSHOTS,{recursive:true});
        await page.screenshot({path:path.join(process.env.DSH_PATCH_SCREENSHOTS, dark?'dark.png':'light.png')});
      }
      await page.evaluate(() => document.body.removeAttribute('data-we-floater-solid'));
      assert.equal(await page.locator('#expert').evaluate(el => getComputedStyle(el).getPropertyValue('--we-popover-bg').trim()),'');
      await page.evaluate(() => {document.body.setAttribute('data-we-floater-solid','');document.body.removeAttribute('data-we-glass-page');});
      assert.equal(await page.locator('#stats').evaluate(el => getComputedStyle(el).getPropertyValue('--we-popover-bg').trim()),'');
    }
    assert.equal(checked,32);
  } finally { await browser.close(); }
});
