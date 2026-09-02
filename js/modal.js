/**
 * modal.js
 * Generic modal/dialog behavior shared by every modal in the app: open/close
 * transitions, Escape-to-close, backdrop-click-to-close, and a focus trap so
 * Tab/Shift+Tab never escapes the dialog while it is open (Part 4 a11y
 * requirement). Also exposes `confirm()`/`prompt()` helpers that build a
 * throwaway dialog on demand, replacing every alert()/confirm() call.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;

    const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    let openStack = []; // supports (rare) stacked modals; topmost handles Escape
    const pendingHideTimeouts = new WeakMap(); // overlay -> timeout id, so a rapid close+reopen can't leave a stale hide pending

    function getEls(idOrEl) {
        const overlay = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
        if (!overlay) return null;
        const panel = overlay.querySelector('[data-modal-panel]') || overlay.firstElementChild;
        return { overlay, panel };
    }

    function trapKeydown(e, panel) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            const top = openStack[openStack.length - 1];
            if (top) close(top.overlay);
            return;
        }
        if (e.key !== 'Tab') return;
        const focusables = U.qsa(FOCUSABLE, panel).filter(el => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    }

    function open(idOrEl, opts = {}) {
        const found = getEls(idOrEl);
        if (!found) return;
        const { overlay, panel } = found;

        const pending = pendingHideTimeouts.get(overlay);
        if (pending) { clearTimeout(pending); pendingHideTimeouts.delete(overlay); }

        const previouslyFocused = document.activeElement;
        overlay.classList.remove('hidden');
        overlay.setAttribute('role', overlay.getAttribute('role') || 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const keyHandler = (e) => trapKeydown(e, panel);
        const backdropHandler = (e) => {
            if (e.target === overlay && opts.closeOnBackdrop !== false) close(overlay);
        };
        overlay.addEventListener('keydown', keyHandler);
        overlay.addEventListener('mousedown', backdropHandler);

        const entry = { overlay, panel, previouslyFocused, keyHandler, backdropHandler };
        openStack.push(entry);

        requestAnimationFrame(() => {
            overlay.classList.add('is-open');
            const autofocusTarget = panel.querySelector('[autofocus]') || panel.querySelector(FOCUSABLE) || panel;
            if (autofocusTarget) autofocusTarget.focus({ preventScroll: true });
        });

        if (typeof opts.onOpen === 'function') opts.onOpen(panel);
    }

    function close(idOrEl) {
        const found = getEls(idOrEl);
        if (!found) return;
        const { overlay } = found;
        const idx = openStack.findIndex(e => e.overlay === overlay);
        const entry = idx > -1 ? openStack[idx] : null;

        overlay.classList.remove('is-open');
        const timeoutId = setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.removeAttribute('aria-modal');
            pendingHideTimeouts.delete(overlay);
        }, 180);
        pendingHideTimeouts.set(overlay, timeoutId);

        if (entry) {
            overlay.removeEventListener('keydown', entry.keyHandler);
            overlay.removeEventListener('mousedown', entry.backdropHandler);
            openStack.splice(idx, 1);
            if (entry.previouslyFocused && typeof entry.previouslyFocused.focus === 'function') {
                entry.previouslyFocused.focus({ preventScroll: true });
            }
        }
    }

    function isOpen(idOrEl) {
        const found = getEls(idOrEl);
        return !!found && !found.overlay.classList.contains('hidden');
    }

    // --- Ad-hoc confirm() dialog, built once and reused ------------------

    let confirmOverlay = null;
    function ensureConfirmDom() {
        if (confirmOverlay) return confirmOverlay;
        confirmOverlay = U.el('div', { className: 'modal-overlay modal-overlay--nested hidden', attrs: { id: 'genericConfirmModal' } }, [
            U.el('div', { className: 'modal-panel modal-panel--sm', attrs: { 'data-modal-panel': '' } }, [
                U.el('div', { className: 'modal-panel__icon modal-panel__icon--warn' }, [
                    U.el('span', { className: 'material-symbols-outlined', text: 'help' })
                ]),
                U.el('h2', { className: 'modal-title text-center', attrs: { id: 'genericConfirmTitle' } }),
                U.el('p', { className: 'modal-text text-center', attrs: { id: 'genericConfirmMessage' } }),
                U.el('div', { className: 'modal-actions' }, [
                    U.el('button', { className: 'btn btn--ghost btn--flex', attrs: { type: 'button', id: 'genericConfirmCancel' } }),
                    U.el('button', { className: 'btn btn--danger btn--flex', attrs: { type: 'button', id: 'genericConfirmOk' } })
                ])
            ])
        ]);
        document.body.appendChild(confirmOverlay);
        return confirmOverlay;
    }

    function confirmDialog({ title, message, confirmText, cancelText, danger = true } = {}) {
        const overlay = ensureConfirmDom();
        overlay.querySelector('#genericConfirmTitle').textContent = title || '';
        overlay.querySelector('#genericConfirmMessage').textContent = message || '';
        const okBtn = overlay.querySelector('#genericConfirmOk');
        const cancelBtn = overlay.querySelector('#genericConfirmCancel');
        okBtn.textContent = confirmText || 'OK';
        cancelBtn.textContent = cancelText || 'Cancel';
        okBtn.className = 'btn btn--flex ' + (danger ? 'btn--danger' : 'btn--primary');

        return new Promise((resolve) => {
            const onOk = () => { cleanup(); close(overlay); resolve(true); };
            const onCancel = () => { cleanup(); close(overlay); resolve(false); };
            function cleanup() {
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
            }
            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
            open(overlay);
        });
    }

    TFS.Modal = { open, close, isOpen, confirm: confirmDialog };

})(window);
