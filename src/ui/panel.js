import { injectThemeRgbVariables } from '../utils/theme.js';
import { renderExtensionTemplateAsync } from '../../../../../extensions.js';
import { renderSettingsTab }  from './tab-settings.js';
import { renderVariablesTab } from './tab-variables.js';
import { renderGoalsTab }     from './tab-goals.js';
import { renderStorylineTab } from './tab-storyline.js';
import { renderBackstageTab } from './tab-backstage.js';
import { renderPromptsTab }   from './tab-prompts.js';
import { renderLogsTab }      from './tab-logs.js';

let overlayElement = null;
let activeTabId = localStorage.getItem('plot_active_tab_id') || 'variables';
let _lastThemeHash = null; // P2: track theme state to avoid redundant DOM work

// ── Tab Definitions ──────────────────────────────────────────────────────────

const TABS = [
    { id: 'variables', icon: 'fa-sliders',        label: '',  render: renderVariablesTab },
    { id: 'goals',     icon: 'fa-bullseye',       label: '',  render: renderGoalsTab     },
    { id: 'storyline', icon: 'fa-map',            label: '',  render: renderStorylineTab },
    { id: 'backstage', icon: 'fa-masks-theater',  label: '',  render: renderBackstageTab },
    { id: 'prompts',   icon: 'fa-pen-to-square',  label: '',  render: renderPromptsTab   },
    { id: 'logs',      icon: 'fa-receipt',        label: '',  render: renderLogsTab      },
    { id: 'settings',  icon: 'fa-gear',           label: '',  render: renderSettingsTab  },
];

// ── Build Popup DOM ──────────────────────────────────────────────────────────

export async function createPopupDOM() {
    let overlay = document.getElementById('plot-popup-overlay');
    if (overlay) {
        return {
            overlay,
            content: overlay.querySelector('.plot-popup-content'),
        };
    }

    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/panel');
    const temp = document.createElement('div');
    temp.innerHTML = html.trim();
    overlay = temp.firstElementChild;
    document.body.appendChild(overlay);

    const content = overlay.querySelector('.plot-popup-content');
    const closeBtn = overlay.querySelector('#plot-popup-close-btn');
    closeBtn.addEventListener('click', hidePanel);

    const tabBar = overlay.querySelector('#plot-tab-bar');
    const paneWrapper = overlay.querySelector('#plot-pane-wrapper');

    TABS.forEach(tab => {
        const btn = document.createElement('div');
        btn.className = 'plot-tab' + (tab.id === activeTabId ? ' active' : '');
        btn.dataset.tab = tab.id;
        btn.title = tab.id;
        btn.innerHTML = `<i class="fa-solid ${tab.icon}"></i><span class="plot-badge" id="plot-badge-${tab.id}"></span>`;
        btn.addEventListener('click', () => switchTab(tab.id));
        tabBar.appendChild(btn);
    });

    TABS.forEach(tab => {
        const pane = document.createElement('div');
        pane.className = 'plot-tab-pane' + (tab.id === activeTabId ? ' active' : '');
        pane.id = `plot-pane-${tab.id}`;
        paneWrapper.appendChild(pane);
    });

    // Close on backdrop click
    overlay.addEventListener('click', e => { if (e.target === overlay) hidePanel(); });

    overlayElement = overlay;
    return { overlay, content };
}

// ── Tab Switching ────────────────────────────────────────────────────────────

function switchTab(tabId) {
    activeTabId = tabId;
    localStorage.setItem('plot_active_tab_id', tabId);

    // Update tab bar
    document.querySelectorAll('#plot-tab-bar .plot-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Show/hide panes; lazy-render on first show
    TABS.forEach(tab => {
        const pane = document.getElementById(`plot-pane-${tab.id}`);
        if (!pane) return;

        const isActive = tab.id === tabId;
        pane.classList.toggle('active', isActive);

        if (isActive && !pane.dataset.rendered) {
            // B9 Fix: mark as rendered BEFORE the async call to prevent double-render on
            // fast re-clicks, then catch and reset if the render actually fails.
            pane.dataset.rendered = 'true';
            Promise.resolve(tab.render(pane)).catch(err => {
                console.error(`[Plot Panel] Failed to render tab "${tab.id}":`, err);
                pane.dataset.rendered = ''; // allow a retry on next activation
            });
        }
    });
}

// ── Show / Hide ──────────────────────────────────────────────────────────────

/**
 * @param {Object} options
 * @param {string} [options.position]  'normal'|'left'|'right'|'top'|'bottom'
 * @param {string} [options.size]      percentage or px, e.g. '80%'
 * @param {string} [options.tab]       which tab to activate
 */
export async function showPanel(options = {}) {
    // P2: Only re-inject theme RGB variables when the theme actually changes,
    // to avoid repeated DOM insertions on every panel open.
    const currentThemeHash = document.documentElement.getAttribute('data-theme') || document.body.className;
    if (_lastThemeHash !== currentThemeHash) {
        injectThemeRgbVariables();
        _lastThemeHash = currentThemeHash;
    }

    const { overlay, content } = await createPopupDOM();

    // Resolve position / size from options or extension settings
    const ctx = SillyTavern.getContext();
    const s = ctx.extensionSettings?.plot || {};
    const position = options.position || s.panelPosition || 'normal';
    const size     = options.size     || s.panelSize     || '80%';

    // Apply position class
    content.classList.remove('position-normal', 'position-left', 'position-right', 'position-top', 'position-bottom');
    content.classList.add(`position-${position}`);

    // Apply size via CSS variables
    content.style.removeProperty('--plot-popup-width');
    content.style.removeProperty('--plot-popup-height');
    if (position === 'normal') {
        content.style.setProperty('--plot-popup-width',  size);
        content.style.setProperty('--plot-popup-height', size);
    } else if (position === 'left' || position === 'right') {
        content.style.setProperty('--plot-popup-width', size);
    } else {
        content.style.setProperty('--plot-popup-height', size);
    }

    // Activate requested tab (default: remember last)
    const targetTab = options.tab || activeTabId;
    switchTab(targetTab);

    // Refresh tabs display state based on enabled modules
    refreshTabVisibility();

    // Show with transition
    overlay.style.display = 'block';
    setTimeout(() => overlay.classList.add('show'), 10);
}

export function refreshTabVisibility() {
    const ctx = SillyTavern.getContext();
    const s = ctx.extensionSettings?.plot || {};
    const modules = s.modules || {};

    TABS.forEach(tab => {
        const tabBtn = document.querySelector(`#plot-tab-bar .plot-tab[data-tab="${tab.id}"]`);
        if (!tabBtn) return;

        const isModule = ['variables', 'goals', 'storyline', 'backstage', 'logs'].includes(tab.id);
        const isEnabled = !isModule || modules[tab.id] !== false;

        if (isEnabled) {
            tabBtn.style.display = 'block';
        } else {
            tabBtn.style.display = 'none';
            if (activeTabId === tab.id) {
                switchTab('settings');
            }
        }
    });
}

export function hidePanel() {
    if (!overlayElement) return;
    overlayElement.classList.remove('show');
    setTimeout(() => {
        if (!overlayElement.classList.contains('show')) {
            overlayElement.style.display = 'none';
        }
    }, 300);
}

/** Mark a tab as having updates (shows badge) */
export function setTabBadge(tabId, show = true) {
    const badge = document.getElementById(`plot-badge-${tabId}`);
    if (badge) badge.classList.toggle('show', show);
}
