/**
 * profile.js
 * Screen 0: a lightweight local "login" — really a named profile switcher,
 * since this app has no server to authenticate against. Each profile gets
 * its own isolated state blob (storage.js's `profileStateKey`), so two
 * people sharing one computer never see each other's plan, points or
 * flashcards. Switching profiles reloads the page on purpose: that is the
 * one moment every other stateful engine (the Pomodoro timer, ambient audio,
 * i18n) is already known to restart cleanly from (see settings.js's
 * import/reset handlers), so this reuses that same pattern rather than
 * inventing a live in-place state swap.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;
    const I18n = TFS.I18n;
    const Storage = TFS.Storage;

    const AVATAR_EMOJIS = ['📚', '🎓', '🦉', '🧠', '🚀', '🌟', '🐯', '🍀'];
    let selectedEmoji = AVATAR_EMOJIS[0];

    const profileListContainer = document.getElementById('profileListContainer');
    const profileEmojiPicker = document.getElementById('profileEmojiPicker');
    const newProfileNameInput = document.getElementById('newProfileNameInput');
    const createProfileBtn = document.getElementById('createProfileBtn');

    function renderEmojiPicker() {
        profileEmojiPicker.innerHTML = '';
        AVATAR_EMOJIS.forEach(emoji => {
            const isSelected = emoji === selectedEmoji;
            profileEmojiPicker.appendChild(U.el('button', {
                className: 'profile-emoji-btn' + (isSelected ? ' is-selected' : ''),
                attrs: { type: 'button', role: 'radio', 'aria-checked': isSelected ? 'true' : 'false' },
                text: emoji,
                on: { click: () => { selectedEmoji = emoji; renderEmojiPicker(); } }
            }));
        });
    }

    function renderProfileList() {
        profileListContainer.innerHTML = '';
        const profiles = Storage.listProfiles();
        if (profiles.length === 0) return;

        profiles.forEach(profile => {
            const card = U.el('div', { className: 'profile-pick-card' }, [
                U.el('button', {
                    className: 'profile-pick-card__main', attrs: { type: 'button' },
                    on: { click: () => selectProfile(profile.id) }
                }, [
                    U.el('span', { className: 'profile-pick-card__avatar', text: profile.emoji || '📚' }),
                    U.el('span', { className: 'profile-pick-card__name', text: profile.name }),
                    U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'chevron_right' })
                ]),
                U.el('button', {
                    className: 'icon-btn icon-btn--danger', attrs: { type: 'button', 'aria-label': I18n.t('s0.deleteProfile') },
                    on: { click: (e) => { e.stopPropagation(); confirmDeleteProfile(profile); } }
                }, [U.el('span', { className: 'material-symbols-outlined', attrs: { 'aria-hidden': 'true' }, text: 'delete' })])
            ]);
            profileListContainer.appendChild(card);
        });
    }

    function selectProfile(id) {
        Storage.switchProfile(id);
        global.location.reload();
    }

    async function confirmDeleteProfile(profile) {
        const ok = await TFS.Modal.confirm({
            title: I18n.t('s0.deleteConfirmTitle'),
            message: I18n.t('s0.deleteConfirmMsg', { name: profile.name }),
            confirmText: I18n.t('common.delete'),
            cancelText: I18n.t('common.cancel'),
            danger: true
        });
        if (!ok) return;
        Storage.deleteProfile(profile.id);
        renderProfileList();
    }

    createProfileBtn.addEventListener('click', () => {
        const name = newProfileNameInput.value.trim();
        if (!name) { TFS.Toast.warn(I18n.t('s0.errName')); return; }
        Storage.createProfile(name, selectedEmoji);
        global.location.reload();
    });

    I18n.onChange(() => { renderEmojiPicker(); renderProfileList(); });

    TFS.Router.register('screen0', {
        onEnter: () => {
            TFS.Nav.hide();
            newProfileNameInput.value = '';
            selectedEmoji = AVATAR_EMOJIS[0];
            renderEmojiPicker();
            renderProfileList();
        }
    });

    TFS.Profile = { AVATAR_EMOJIS };

})(window);
