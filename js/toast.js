/**
 * toast.js
 * Lightweight in-app toast notifications, replacing every alert()/confirm()
 * in the original code (Part 4 requirement). Toasts live in a single
 * aria-live region so screen readers announce them without stealing focus.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;

    let container = null;

    function ensureContainer() {
        if (container) return container;
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'false');
        document.body.appendChild(container);
        return container;
    }

    const ICONS = { info: 'info', success: 'check_circle', warn: 'warning', error: 'error' };

    function show(message, type = 'info', duration = 4000) {
        const root = ensureContainer();
        const node = U.el('div', { className: `toast toast--${type}`, attrs: { role: 'status' } }, [
            U.el('span', { className: 'material-symbols-outlined toast__icon', attrs: { 'aria-hidden': 'true' }, text: ICONS[type] || ICONS.info }),
            U.el('span', { className: 'toast__msg', text: message }),
            U.el('button', {
                className: 'toast__close', attrs: { type: 'button', 'aria-label': TFS.I18n ? TFS.I18n.t('aria.dismissToast') : 'Dismiss' }, text: '×',
                on: { click: () => dismiss(node) }
            })
        ]);
        root.appendChild(node);
        requestAnimationFrame(() => node.classList.add('toast--visible'));

        const timer = setTimeout(() => dismiss(node), duration);
        node.addEventListener('mouseenter', () => clearTimeout(timer));
        return node;
    }

    function dismiss(node) {
        if (!node || !node.parentNode) return;
        node.classList.remove('toast--visible');
        setTimeout(() => node.remove(), 200);
    }

    TFS.Toast = {
        show,
        info: (msg, d) => show(msg, 'info', d),
        success: (msg, d) => show(msg, 'success', d),
        warn: (msg, d) => show(msg, 'warn', d),
        error: (msg, d) => show(msg, 'error', d)
    };

})(window);
