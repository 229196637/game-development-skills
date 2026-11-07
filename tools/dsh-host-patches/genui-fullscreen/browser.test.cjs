'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { chromium } = require('playwright-core');
const { patchBytes } = require('./patch.cjs');
const withFullscreen = require('./fullscreen.cjs');
const installed = process.env.DSH_GENUI_CLIENT || 'C:/Users/22919/.dsh/profiles/desktop/node_modules/@changfenhuang/dsh-genui/lib/client.js';
const output = process.env.DSH_TEST_OUTPUT || 'D:/Project/AIProject/.agent-tmp/20261107-genui-fullscreen/reports-card-v2';
fs.mkdirSync(output, { recursive: true });
const bridge = buildSync({ stdin: { contents: `const React=require('react');const JSX=require('react/jsx-runtime');const DOM=require('react-dom/client'); window.TestBridge={React,JSX,DOM};`, resolveDir: __dirname }, bundle: true, write: false, platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } }).outputFiles[0].text;
let code = patchBytes(fs.readFileSync(installed)).toString();
code = code.replace('/* /dsh-genui-fullscreen:v1 */', 'window.GenuiUnderTest=Sh;/* /dsh-genui-fullscreen:v1 */');
const spec = { title: 'DSH 公网访问：核查结论', items: [
  { type: 'input', id: 'filter', label: '筛选', placeholder: '输入关键字' },
  { type: 'table', filter: 'filter', columns: ['方案', '查到的能力', '排序'], rows: [
    ['方案乙', '内含 dsh Web 隧道：Cloudflare 公网网址、二维码、账号保护。'.repeat(5), '2'],
    ['方案甲', '支持 publicUrl、trustedHosts 与浏览器保护。' + 'https://example.com/' + 'a'.repeat(130), '1'],
    ['方案丙', '远程查看会话、继续对话和处理任务。'.repeat(5), '3'],
  ], details: [[{ type: 'text', content: '明细甲' }], null, null] },
  { type: 'textarea', id: 'draft', label: '备注', rows: 2 },
  { type: 'image-group', title: '图库', items: [{ src: 'https://invalid.example/photo.png', alt: '测试图片' }] },
] };
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.DSH_PATCH_BROWSER_CHANNEL || 'msedge' });
  const evidence = [];
  try {
    for (const dark of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://invalid.example/**', route => route.abort());
      await page.setContent(`<html lang="zh-CN"><head><style>body{margin:0;font:14px/1.6 system-ui;--dsw-alias-label-primary:${dark ? '#f4f4f4' : '#202124'};--dsw-alias-label-secondary:${dark ? '#e0e0e0' : '#444'};--dsw-alias-label-tertiary:${dark ? '#bbb' : '#666'};--dsw-alias-bg-layer-1:${dark ? '#25272c' : '#fff'};background:${dark ? '#17191c' : '#eee'};color:var(--dsw-alias-label-primary)}.chat{width:520px;height:500px;margin:40px;overflow:auto;transform:translateZ(0);border:1px solid #8885}.outside{height:20px}</style></head><body ${dark ? 'data-ds-dark-theme' : ''}><button class="outside">外部按钮</button><div class="chat"><div id="root"></div></div></body></html>`);
      await page.addScriptTag({ content: bridge });
      await page.evaluate(() => {
        window.__ModuleLoader__ = { load({ factory }) { window.GenuiPlugin = factory(id => {
          if (id === 'react') return TestBridge.React;
          if (id === 'react/jsx-runtime') return TestBridge.JSX;
          if (id === 'react-dom/client') return TestBridge.DOM;
          if (id === '@deepseek-ai/dsh-client-ui-primitives') return { CodeBlock: ({ children }) => TestBridge.React.createElement('pre', null, children) };
          throw Error('Unexpected module: ' + id);
        }); } };
      });
      await page.addScriptTag({ content: code });
      await page.evaluate(spec => {
        window.reactRoot = TestBridge.DOM.createRoot(document.getElementById('root'));
        reactRoot.render(TestBridge.React.createElement(GenuiUnderTest, { spec, animateEntrance: false }));
      }, spec);
      const dialog = page.locator('.dsh-genui-fs-dialog');
      const trigger = page.getByRole('button', { name: '展开查看', exact: true });
      await trigger.waitFor();
      assert.equal(await dialog.getAttribute('role'), 'group');
      assert.equal(await dialog.isVisible(), true, 'closed dialog renders inline');
      await page.locator('textarea').fill('未提交的草稿');
      await page.locator('th button').nth(2).click();
      assert.ok((await page.locator('tbody tr').first().innerText()).startsWith('方案甲'), 'numeric sorting works inline');
      await page.evaluate(() => { window.sameInput = document.querySelector('input'); window.sameTable = document.querySelector('table'); });
      await trigger.click();
      await page.waitForFunction(() => document.querySelector('.dsh-genui-fs-dialog').open);
      assert.equal(await dialog.getAttribute('aria-modal'), 'true');
      const reading = await dialog.evaluate(el => {
        const r = el.getBoundingClientRect(); const table = el.querySelector('table');
        return { width: r.width, height: r.height, left: r.left, top: r.top, sameInput: window.sameInput === el.querySelector('input'), sameTable: window.sameTable === table, overflow: table.scrollWidth - table.clientWidth, bg: getComputedStyle(el).backgroundColor, cellWhiteSpace: getComputedStyle(el.querySelector('td')).whiteSpace };
      });
      assert.equal(reading.width, 836, 'card is wider than chat but retains desktop gutters');
      assert.equal(reading.left, 32);
      assert.ok(reading.height <= 570 && reading.top >= 40, 'centered bounded card leaves background visible');
      assert.ok(Math.abs(reading.top * 2 + reading.height - 650) <= 1, 'card is vertically centered');
      assert.equal(await dialog.evaluate(el => getComputedStyle(el).borderRadius), '12px');
      assert.equal(reading.sameInput, true); assert.equal(reading.sameTable, true);
      assert.equal(reading.cellWhiteSpace, 'normal'); assert.ok(reading.overflow <= 1, 'table wraps rather than clips');
      assert.equal(reading.bg, dark ? 'rgb(37, 39, 44)' : 'rgb(255, 255, 255)');
      assert.equal(await page.locator('textarea').inputValue(), '未提交的草稿');
      await page.locator('input').fill('方案甲');
      assert.equal(await page.locator('tbody tr').count(), 1, 'live filter works fullscreen');
      await page.evaluate(() => document.querySelector('.outside').focus());
      assert.equal(await page.locator('.outside').evaluate(el => el === document.activeElement), false, 'background is inert');
      await page.screenshot({ path: path.join(output, dark ? 'card-dark.png' : 'card-light.png') });
      await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
      assert.ok(await dialog.evaluate(el => el.scrollTop > 0), 'long content scrolls inside the card');
      const header = await page.locator('.dsh-genui-fs-header').boundingBox();
      const cardBounds = await dialog.boundingBox();
      assert.ok(Math.abs(header.y - cardBounds.y - 1) <= 1, 'close header remains visible while card scrolls');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.dsh-genui-fs-dialog').open);
      assert.equal(await page.locator('input').inputValue(), '方案甲');
      assert.equal(await page.locator('textarea').inputValue(), '未提交的草稿');
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'focus restored');
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      await page.locator('input').fill('');
      assert.ok((await page.locator('tbody tr').first().innerText()).startsWith('方案甲'), 'sort preserved after exit');
      await page.setViewportSize({ width: 390, height: 844 });
      await trigger.click();
      assert.equal(await dialog.evaluate(el => Math.round(el.getBoundingClientRect().width)), 358);
      assert.equal(await dialog.evaluate(el => Math.round(el.getBoundingClientRect().left)), 16);
      assert.ok(await dialog.evaluate(el => el.getBoundingClientRect().height <= 812), 'mobile still keeps card gutters');
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'mobile dialog has no horizontal viewport overflow');
      // Gallery nested native dialog must close itself, not the parent fullscreen.
      await page.locator('button[aria-haspopup="dialog"]').last().click();
      assert.equal(await page.locator('dialog[open]').count(), 2);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog[open]').count(), 1);
      assert.equal(await dialog.evaluate(el => el.open), true);
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      assert.equal(await dialog.evaluate(el => el.open), false);
      await trigger.click();
      await page.mouse.click(4, 4);
      assert.equal(await dialog.evaluate(el => el.open), false, 'backdrop click closes card');
      assert.equal(await page.locator('textarea').inputValue(), '未提交的草稿');
      await page.setViewportSize({ width: 1720, height: 1021 });
      await trigger.click();
      const wideBounds = await dialog.boundingBox();
      assert.equal(wideBounds.width, 1360, 'reference-size desktop card is capped at 1360px');
      assert.equal(wideBounds.x, 180);
      assert.ok(wideBounds.y >= 40);
      await dialog.evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: path.join(output, dark ? 'card-reference-dark.png' : 'card-reference-light.png') });
      await page.evaluate(() => reactRoot.unmount());
      assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'unmount restores scroll lock');
      await page.evaluate(() => {
        reactRoot = TestBridge.DOM.createRoot(document.getElementById('root'));
        reactRoot.render(TestBridge.React.createElement(GenuiUnderTest, { spec: { title: '简短内容', items: [{ type: 'text', content: '只展开一张查看卡片。' }] }, animateEntrance: false }));
      });
      await trigger.click();
      const short = await dialog.evaluate(el => ({ height: el.getBoundingClientRect().height, cssHeight: getComputedStyle(el).height, minHeight: getComputedStyle(el).minHeight, text: el.innerText.slice(0, 300) }));
      await page.screenshot({ path: path.join(output, 'card-short.png') });
      assert.ok(short.height < 300, 'short content fits the card instead of filling the screen: ' + JSON.stringify(short));
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      assert.deepEqual(errors, []);
      evidence.push({ dark, desktop: '900x650', mobile: '390x844', sameNodes: true, statePreserved: true, nestedGallery: true, ...reading });
      await page.close();
    }
    // Shared lock regression: two nested fullscreen wrappers, parent-first unmount.
    const page = await browser.newPage();
    await page.setContent('<html lang="zh-CN"><body style="overflow:scroll"><div id="root"></div></body></html>');
    await page.addScriptTag({ content: bridge });
    await page.addScriptTag({ content: `window.Wrap=(${withFullscreen.toString()}); window.css=${JSON.stringify(fs.readFileSync(path.join(__dirname, 'fullscreen.css'), 'utf8'))};` });
    await page.evaluate(() => {
      const { React, DOM } = TestBridge, h = React.createElement;
      let Wrapped;
      function Original(props) { return props.child ? h('p', null, '子内容') : h(Wrapped, { child: true, spec: { title: '子全屏' } }); }
      Wrapped = Wrap(Original, React, window.css);
      window.root = DOM.createRoot(document.getElementById('root'));
      root.render(h(Wrapped, { spec: { title: '父全屏' } }));
    });
    await page.getByRole('button', { name: '展开查看', exact: true }).first().click();
    await page.getByRole('button', { name: '展开查看', exact: true }).last().click();
    assert.equal(await page.locator('dialog[open]').count(), 2);
    await page.evaluate(() => root.unmount());
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'scroll');
    await page.close();
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(evidence, null, 2));
    console.log('PASS: actual GenUI bundle, centered card gutters and width cap, short-content sizing, internal scroll/sticky close, light/dark, wrapping, same DOM, sorting/filter/draft state, Escape/button/backdrop close, focus restoration, nested gallery, scroll lock and unmount.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
