'use strict';

/**
 * Wrap the upstream ExportableGenuiBlock without replacing its renderer.
 * The SAME React child stays mounted inside the SAME dialog in both modes:
 * no cloning, portals, DOM reparenting, action round trips or storage writes.
 * Native showModal promotes it to the top layer, outside chat clipping/transform.
 * The closed dialog is deliberately displayed as an ordinary inline group.
 */
module.exports = function withGenuiFullscreen(Original, React, stylesheet) {
  const { createElement: h, useEffect, useId, useRef, useState } = React;
  // One shared lock for all blocks, safe even when nested dialogs unmount
  // parent-first. Per-instance saved overflow can leave the page locked.
  let scrollLocks = 0;
  let savedOverflow = '';
  let savedPriority = '';
  if (!document.querySelector('style[data-genui-fullscreen-style]')) {
    const style = document.createElement('style');
    style.setAttribute('data-genui-fullscreen-style', '1');
    style.textContent = stylesheet;
    document.head.appendChild(style);
  }

  function FullscreenGenuiBlock(props) {
    const dialogRef = useRef(null);
    const triggerRef = useRef(null);
    const closeRef = useRef(null);
    const expandedRef = useRef(false);
    const [expanded, setExpanded] = useState(false);
    const [height, setHeight] = useState(0);
    const [error, setError] = useState('');
    const titleId = useId();
    const lang = document.documentElement.lang || navigator.language || 'zh-CN';
    const zh = /^zh\b/i.test(lang);
    const labels = zh
      ? { open: '展开查看', close: '关闭', title: '内容查看', hint: '按 Esc 返回对话', error: '当前环境无法打开查看卡片，请升级浏览器后重试。' }
      : { open: 'Expand view', close: 'Close', title: 'Content viewer', hint: 'Press Esc to return', error: 'Expanded view is unavailable. Please update your browser and try again.' };

    // The inline placeholder keeps the chat's height/scroll anchor stable.
    const open = () => {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      if (typeof dialog.showModal !== 'function') { setError(labels.error); return; }
      const inlineHeight = dialog.getBoundingClientRect().height;
      try {
        dialog.showModal();
        expandedRef.current = true;
        setHeight(inlineHeight);
        setExpanded(true);
        setError('');
        closeRef.current?.focus({ preventScroll: true });
        window.dispatchEvent(new Event('resize'));
      } catch {
        setError(labels.error);
      }
    };
    const finishClose = () => {
      if (!expandedRef.current) return;
      expandedRef.current = false;
      setExpanded(false);
      setHeight(0);
      if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
      window.dispatchEvent(new Event('resize'));
    };
    const close = () => {
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      finishClose();
    };

    useEffect(() => {
      if (!expanded) return;
      const body = document.body;
      if (scrollLocks++ === 0) {
        savedOverflow = body.style.getPropertyValue('overflow');
        savedPriority = body.style.getPropertyPriority('overflow');
        body.style.setProperty('overflow', 'hidden');
      }
      return () => {
        if (--scrollLocks !== 0) return;
        if (savedOverflow) body.style.setProperty('overflow', savedOverflow, savedPriority);
        else body.style.removeProperty('overflow');
      };
    }, [expanded]);

    // Closing/unmounting a turn removes the native top-layer dialog as well.
    // No global event listener/observer survives an unmount.
    return h('section', { 'data-genui-fullscreen-root': '' },
      h('div', { className: 'dsh-genui-fs-toolbar' },
        error && h('span', { role: 'status', className: 'dsh-genui-fs-error' }, error),
        h('button', {
          ref: triggerRef, type: 'button', className: 'dsh-genui-fs-button',
          'aria-haspopup': 'dialog', 'aria-expanded': expanded,
          onClick: open, title: labels.open,
        }, h('svg', { width: 15, height: 15, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
          h('path', { d: 'M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' })), labels.open)),
      h('div', { style: expanded ? { minHeight: height } : undefined },
        h('dialog', {
          ref: dialogRef, className: 'dsh-genui-fs-dialog',
          role: expanded ? 'dialog' : 'group',
          'aria-modal': expanded ? true : undefined,
          'aria-labelledby': expanded ? titleId : undefined,
          onCancel: event => {
            if (event.target !== event.currentTarget) return;
            event.preventDefault(); event.stopPropagation(); close();
          },
          onClose: event => {
            if (event.target !== event.currentTarget) return;
            if (!dialogRef.current?.open) finishClose();
          },
          onClick: event => {
            if (event.target !== event.currentTarget || !dialogRef.current?.open) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
          },
        },
        h('header', { className: 'dsh-genui-fs-header' },
          h('div', { className: 'dsh-genui-fs-heading' },
            h('span', { id: titleId }, props.spec?.title || labels.title),
            h('span', { className: 'dsh-genui-fs-hint' }, labels.hint)),
          h('button', { ref: closeRef, type: 'button', className: 'dsh-genui-fs-button', onClick: close, title: labels.close },
            h('span', { 'aria-hidden': true }, '×'), labels.close)),
        h('div', { className: 'dsh-genui-fs-content' }, h(Original, props)))));
  }
  FullscreenGenuiBlock.displayName = 'FullscreenGenuiBlock';
  return FullscreenGenuiBlock;
};
