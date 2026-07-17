import { getContext } from '../../../extensions.js';
import { injectThemeRgbVariables } from './src/utils/theme.js';
import { showPanel } from './src/ui/panel.js';
import { registerHooks } from './src/core/hooks.js';
import { loadPlotData } from './src/core/storage.js';
import { registerMacros } from './src/utils/macro.js';

const MODULE_NAME = 'plot';
const QR_BTN_ID = 'plot-qr-btn';
const MENU_BTN_ID = 'plot-menu-btn';

const ctx = getContext();
const { eventSource, eventTypes: event_types } = ctx;

// Initialize settings
if (!ctx.extensionSettings[MODULE_NAME]) {
    ctx.extensionSettings[MODULE_NAME] = {
        enabled: true,
        version: "0.1.0"
    };
}

// 1. Create QR Button
function createQrButton() {
    const btn = document.createElement('div');
    btn.id = QR_BTN_ID;
    btn.className = 'qr--button menu_button interactable';
    btn.tabIndex = 0;
    btn.role = 'button';
    btn.title = '剧情推动 (Plot)';
    btn.innerHTML = '<i class="fa-solid fa-book-open"></i>';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showPanel();
    });
    return btn;
}

// 2. Inject QR Button
function injectQrButton() {
    if (document.getElementById(QR_BTN_ID)) return;

    const btnContainer = document.querySelector('#qr--bar .qr--buttons');
    if (btnContainer) {
        btnContainer.prepend(createQrButton());
        return;
    }

    const qrBar = document.getElementById('qr--bar');
    if (qrBar) {
        qrBar.prepend(createQrButton());
    }
}

// 3. Inject Magic Wand Menu Button
function injectMenuButton() {
    if (document.getElementById(MENU_BTN_ID)) return;

    const btnHtml = `
        <div id="${MENU_BTN_ID}" class="list_item interactable" title="剧情推动">
            <i class="fa-solid fa-book-open"></i>
            <span class="list_item_text plot-no-shrink">剧情推动</span>
        </div>
    `;

    const target = document.querySelector('#extensionsMenu.options-content');
    if (target) {
        const temp = document.createElement('div');
        temp.innerHTML = btnHtml.trim();
        const element = temp.firstChild;
        element.addEventListener('click', () => {
            showPanel();
        });
        target.appendChild(element);
    }
}

// 4. Retry Injection
function injectWithRetry(attempts = 0) {
    if (attempts > 15) return; // Give up after ~7.5s

    injectQrButton();
    injectMenuButton();

    if (!document.getElementById(QR_BTN_ID) || !document.getElementById(MENU_BTN_ID)) {
        setTimeout(() => injectWithRetry(attempts + 1), 500);
    }
}

// 5. Debounce helper for MutationObserver (avoids flooding on rapid DOM changes)
function debounce(fn, ms) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// 5. Hook initialization
export async function init() {
    // Inject Theme RGB variables on start
    injectThemeRgbVariables();
    
    // Inject UI buttons
    injectWithRetry();

    // Register event hooks and load initial data
    registerHooks(eventSource, event_types);
    await loadPlotData();

    // Register plot macros ({{plot_state}} etc.)
    registerMacros();

    // Set up MutationObserver to re-inject if elements are cleared by ST re-renders
    // Debounced to 150ms to avoid flooding on rapid DOM mutations
    const handleMutation = debounce(() => {
        const hasQrContainer = document.querySelector('#qr--bar .qr--buttons') || document.getElementById('qr--bar');
        const hasMenuContainer = document.querySelector('#extensionsMenu.options-content');

        if (hasQrContainer && !document.getElementById(QR_BTN_ID)) {
            injectQrButton();
        }
        if (hasMenuContainer && !document.getElementById(MENU_BTN_ID)) {
            injectMenuButton();
        }
    }, 150);

    const observer = new MutationObserver(handleMutation);
    observer.observe(document.body, { childList: true, subtree: true });

    // Listen to CHAT_CHANGED to eagerly re-inject (covers cases where observer may miss)
    eventSource.on(event_types.CHAT_CHANGED, () => {
        injectQrButton();
        injectMenuButton();
    });
}
