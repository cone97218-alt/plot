/**
 * tab-backstage.js - Backstage UI (secondary dialogue console)
 * Keeps independent dialogue histories per Mode, decoupled from main chat logs.
 * Supports Markdown/HTML rendering, Mode Configuration, Theme Manager, and message operations (Delete, Edit, Modify, Swipe pagination, Retry).
 */

import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../../../extensions.js';
import { selected_world_info, loadWorldInfo } from '../../../../../world-info.js';
import { get, set, subscribe } from '../core/store.js';
import { loadPlotData, savePlotData, getBtsDBKey } from '../core/storage.js';
import { buildContext } from '../core/context-reader.js';
import { resolvePlaceholders, assemblePrompt, getBlocks } from '../core/prompt-builder.js';
import { callAI, listConnections, callAIStream } from '../core/api-client.js';
import { renderBookChecklist, subscribeWIRefresh } from '../utils/dom.js';

let rootEl = null;
let currentAbortController = null;
let currentBtsReloadWI = null;
let _btsWiUnsubscribe = null; // tracks the active WI event subscription (replaces isBtsEventBound)

// Helper to escape HTML tags for safe markdown preprocessing
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Local size-limited cache for parsed markdown content to avoid redundant parsing/sanitization
const markdownCache = new Map();
const MAX_CACHE_SIZE = 500;

function renderMessageContentCached(text) {
    if (!text) return '';
    let cached = markdownCache.get(text);
    if (cached !== undefined) return cached;

    const html = renderMessageContent(text);
    if (markdownCache.size >= MAX_CACHE_SIZE) {
        markdownCache.clear();
    }
    markdownCache.set(text, html);
    return html;
}

// Markdown & HTML renderer using SillyTavern's exposed Showdown and DOMPurify libraries
function renderMessageContent(text) {
    const showdown = window.showdown;
    const DOMPurify = window.DOMPurify;
    
    if (showdown) {
        if (!window.plotBtsConverter) {
            window.plotBtsConverter = new showdown.Converter({
                emoji: true,
                literalMidWordUnderscores: true,
                parseImgDimensions: true,
                tables: true,
                underline: true,
                simpleLineBreaks: true,
                strikethrough: true,
            });
        }
        let html = window.plotBtsConverter.makeHtml(text);
        if (DOMPurify) {
            html = DOMPurify.sanitize(html);
        }
        return html;
    }
    // Fallback if showdown not loaded
    return escapeHtml(text).replace(/\n/g, '<br>');
}

// Render the main backstage tab view
export async function renderBackstageTab(containerEl) {
    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/tab-backstage');
    containerEl.innerHTML = html;
    
    rootEl = containerEl.querySelector('#plot-bts-root');
    if (!rootEl) return;

    // Load initial states and apply themes
    applyThemeStyles();
    
    // Bind all sub-components
    initModeSelector();
    initThreadSelector();
    initChatInterface();
    initUnifiedConfigDrawer();

    // Subscribe to store updates to keep UI synchronized
    subscribe('backstageHistory', () => {
        renderDialogue();
    });

    // Initial render of dialogue history
    renderDialogue();
}

// ── Theme Styling Application ───────────────────────────────────────────────
function applyThemeStyles() {
    const activeThemeId = get('backstageActiveThemeId') || 'default';
    const themes = extension_settings.plot?.backstageThemes || [];
    const theme = themes.find(t => t.id === activeThemeId);

    // Remove existing custom style tag if present
    let styleEl = document.getElementById('plot-bts-custom-theme-style');
    if (styleEl) styleEl.remove();

    if (activeThemeId !== 'default' && theme && theme.customCss) {
        styleEl = document.createElement('style');
        styleEl.id = 'plot-bts-custom-theme-style';
        styleEl.innerHTML = theme.customCss;
        document.head.appendChild(styleEl);
    }
}

// ── Stable Mode Reference Helper ─────────────────────────────────────────────
/**
 * Returns the real mode object from extension_settings.plot.backstageModes
 * that matches the current active mode ID.  If it does not exist yet (e.g.
 * after a data-reset) the default mode entry is injected and returned so that
 * all subsequent write operations target the actual settings array, never a
 * throw-away literal object.
 * @returns {Object} The live mode object reference.
 */
function getActiveMode() {
    const ep = extension_settings.plot;
    if (!ep.backstageModes) ep.backstageModes = [];

    const activeModeId = get('backstageActiveModeId') || 'default';
    let mode = ep.backstageModes.find(m => m.id === activeModeId);

    if (!mode) {
        // Inject a minimal default mode so writes are never lost
        mode = {
            id: 'default',
            name: '默认模式',
            presetId: 'default',
            connectionId: 'default',
            storageScope: 'chat',
            activeThreadId: 'default',
            threads: [{ id: 'default', name: '默认分支' }],
            reading: {}
        };
        ep.backstageModes.unshift(mode);
    }

    // Self-heal missing threads array
    if (!mode.threads || mode.threads.length === 0) {
        mode.threads = [{ id: 'default', name: '默认分支' }];
    }
    if (!mode.activeThreadId) {
        mode.activeThreadId = 'default';
    }

    return mode;
}

// ── Mode Selector Dropdown ───────────────────────────────────────────────────
function initModeSelector() {
    // Use cloneNode to strip any previously attached event listeners before
    // re-binding, preventing stacking when initModeSelector() is called again.
    const oldSelect = rootEl.querySelector('#plot-bts-mode-select');
    const modeSelect = oldSelect.cloneNode(true);
    oldSelect.parentNode.replaceChild(modeSelect, oldSelect);

    // Populate dropdown options
    const populateSelector = () => {
        const modes = extension_settings.plot?.backstageModes || [];
        const activeId = get('backstageActiveModeId') || 'default';
        modeSelect.innerHTML = modes
            .map(m => `<option value="${m.id}" ${m.id === activeId ? 'selected' : ''}>${escapeHtml(m.name)}</option>`)
            .join('');
    };

    populateSelector();
    updateScopeIndicator();

    modeSelect.addEventListener('change', async () => {
        const activeId = modeSelect.value;
        set('backstageActiveModeId', activeId);

        // Sync active prompt preset to the newly selected mode
        const mode = getActiveMode();
        if (mode?.presetId) {
            if (!extension_settings.plot.currentPreset) extension_settings.plot.currentPreset = {};
            extension_settings.plot.currentPreset.backstage = mode.presetId;
        }

        await savePlotData();
        await loadPlotData();
        updateScopeIndicator();
        initThreadSelector();
        renderDialogue();
    });
}

function updateScopeIndicator() {
    const indicator = rootEl.querySelector('#plot-bts-scope-indicator');
    if (!indicator) return;

    const activeId = get('backstageActiveModeId') || 'default';
    const modes = extension_settings.plot?.backstageModes || [];
    const mode = modes.find(m => m.id === activeId) || { storageScope: 'chat' };
    const scope = mode.storageScope || 'chat';

    if (scope === 'chat') {
        indicator.className = 'fa-solid fa-comments';
        indicator.title = '数据保存绑定域: 绑定聊天会话';
    } else if (scope === 'character') {
        indicator.className = 'fa-solid fa-user';
        indicator.title = '数据保存绑定域: 绑定当前角色';
    } else {
        indicator.className = 'fa-solid fa-globe';
        indicator.title = '数据保存绑定域: 全局共享';
    }
}

// ── Thread Selector Dropdown & Branch Control ───────────────────────────────
function initThreadSelector() {
    // Use cloneNode on each interactive element to strip previously attached
    // listeners before re-binding, preventing handler stacking on re-init.
    const replaceEl = (selector) => {
        const old = rootEl.querySelector(selector);
        if (!old) return null;
        const fresh = old.cloneNode(true);
        old.parentNode.replaceChild(fresh, old);
        return fresh;
    };

    const threadSelect = replaceEl('#plot-bts-thread-select');
    const addBtn      = replaceEl('#plot-bts-thread-add-btn');
    const branchBtn   = replaceEl('#plot-bts-thread-branch-btn');
    const delBtn      = replaceEl('#plot-bts-thread-del-btn');
    if (!threadSelect || !addBtn || !delBtn) return;

    // Always resolve via getActiveMode() so writes land on the real settings object
    const mode = getActiveMode();
    const activeModeId = mode.id;
    const threads = mode.threads;
    const activeThreadId = mode.activeThreadId;

    threadSelect.innerHTML = threads
        .map(t => `<option value="${t.id}" ${t.id === activeThreadId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`)
        .join('');

    // ── Switch thread ────────────────────────────────────────────────────────
    threadSelect.addEventListener('change', async () => {
        mode.activeThreadId = threadSelect.value;
        await savePlotData();
        await loadPlotData();
        renderDialogue();
    });

    // ── Add thread (New Blank Dialogue) ──────────────────────────────────────
    addBtn.addEventListener('click', () => {
        showInputModal(
            '新建空白对话',
            '输入新对话的名称，例如：探讨新章节',
            async (name) => {
                const newId = 'thread_' + Date.now();
                mode.threads.push({ id: newId, name });
                mode.activeThreadId = newId;

                // Clear memory history and LoadedKey so it starts fresh & empty
                const newKey = getBtsDBKey(activeModeId, newId);
                set('backstageHistory', []);
                set('backstageHistoryLoadedKey', newKey);

                await savePlotData();
                await loadPlotData();
                initThreadSelector();
                renderDialogue();
            }
        );
    });

    // ── Branch thread (Copy Current History) ──────────────────────────────────
    if (branchBtn) {
        branchBtn.addEventListener('click', () => {
            const currentHistory = get('backstageHistory') || [];
            if (currentHistory.length === 0) {
                alert('当前对话为空，无法分出平行分支！请直接使用“新建空白对话”功能。');
                return;
            }
            showInputModal(
                '分出平行对话 (复制当前历史)',
                '输入新分支的名称，例如：探讨选择B',
                async (name) => {
                    const newId = 'thread_' + Date.now();

                    // Duplicate current history into IndexedDB for the new thread key first
                    const { savePlotValue } = await import('../core/indexeddb.js');
                    const newKey = getBtsDBKey(activeModeId, newId);
                    await savePlotValue(newKey, JSON.parse(JSON.stringify(currentHistory)));

                    mode.threads.push({ id: newId, name });
                    mode.activeThreadId = newId;

                    // Set matching LoadedKey so savePlotData won't skip it next time
                    set('backstageHistoryLoadedKey', newKey);

                    await savePlotData();
                    await loadPlotData();
                    initThreadSelector();
                    renderDialogue();
                }
            );
        });
    }

    // ── Delete thread ────────────────────────────────────────────────────────
    delBtn.addEventListener('click', async () => {
        const targetThreadId = mode.activeThreadId || 'default';
        if (targetThreadId === 'default') {
            alert('默认分支不可被删除！');
            return;
        }

        const confirmed = confirm('确定要删除当前对话分支吗？该操作将物理抹除此分支下的所有聊天记录！');
        if (!confirmed) return;

        // Build the DB key for the thread being deleted BEFORE mutating mode state,
        // using the parameterized getBtsDBKey() to avoid duplicating key logic.
        const dbKey = getBtsDBKey(activeModeId, targetThreadId);

        mode.threads = mode.threads.filter(t => t.id !== targetThreadId);
        mode.activeThreadId = 'default';

        const { deletePlotValue } = await import('../core/indexeddb.js');
        await deletePlotValue(dbKey);

        await savePlotData();
        await loadPlotData();
        initThreadSelector();
        renderDialogue();
    });
}

// ── Unified Configuration Drawer ─────────────────────────────────────────────
function initUnifiedConfigDrawer() {
    const cfgToggleBtn = rootEl.querySelector('#plot-bts-cfg-toggle-btn');
    const configDrawer = rootEl.querySelector('#plot-bts-config-drawer');
    const closeBtn = rootEl.querySelector('#plot-bts-config-drawer-close');
    const saveBtn = rootEl.querySelector('#plot-bts-cfg-save-btn');

    // 1. Drawer Toggle
    cfgToggleBtn.addEventListener('click', () => {
        loadConfigsIntoDrawer();
        // Activate the last active tab (default: 'mode')
        const lastActiveTab = localStorage.getItem('plot_active_backstage_drawer_tab_id') || 'mode';
        switchConfigTab(lastActiveTab);
        configDrawer.classList.add('show');
    });

    const closeFullscreen = () => {
        const wrapper = configDrawer.querySelector('.plot-bts-css-wrapper');
        if (wrapper && wrapper.classList.contains('plot-bts-css-fullscreen-active')) {
            wrapper.classList.remove('plot-bts-css-fullscreen-active');
            const cssFullscreenBtn = configDrawer.querySelector('#plot-bts-theme-css-fullscreen');
            if (cssFullscreenBtn) {
                const span = cssFullscreenBtn.querySelector('span');
                const icon = cssFullscreenBtn.querySelector('i');
                if (span) span.textContent = '全屏';
                if (icon) {
                    icon.className = 'fa-solid fa-expand';
                }
                cssFullscreenBtn.title = '全屏编辑';
            }
        }
    };

    closeBtn.addEventListener('click', () => {
        closeFullscreen();
        configDrawer.classList.remove('show');
    });

    // 2. Config Tab Switching
    const tabs = configDrawer.querySelectorAll('#plot-bts-cfg-tabs .plot-sub-tab');
    const panes = configDrawer.querySelectorAll('.plot-bts-cfg-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.cfgtab;
            switchConfigTab(target);
        });
    });

    const switchConfigTab = (target) => {
        localStorage.setItem('plot_active_backstage_drawer_tab_id', target);
        tabs.forEach(t => t.classList.toggle('active', t.dataset.cfgtab === target));
        panes.forEach(p => {
            if (p.id === `plot-bts-cfg-pane-${target}`) {
                p.style.display = 'flex';
            } else {
                p.style.display = 'none';
            }
        });
    };

    // 3. Tab 1: Mode & Presets Bindings
    const addModeBtn = configDrawer.querySelector('#plot-bts-mode-add-btn');
    const deleteModeBtn = configDrawer.querySelector('#plot-bts-mode-delete-btn');

    // Add Mode
    addModeBtn.addEventListener('click', () => {
        const name = prompt('请输入新模式名称:');
        if (!name || !name.trim()) return;

        const scopePrompt = prompt('请选择该模式的数据保存域（输入数字）：\n1. 绑定聊天会话 (chat - 默认)\n2. 绑定当前角色 (character)\n3. 全局共享 (global)\n(留空或输入其他默认选择 1)');
        let scope = 'chat';
        if (scopePrompt === '2') scope = 'character';
        if (scopePrompt === '3') scope = 'global';

        const modes = extension_settings.plot?.backstageModes || [];
        const newId = 'mode_' + Date.now();
        const globalReading = extension_settings.plot?.reading || {};

        const newMode = {
            id: newId,
            name: name.trim(),
            presetId: 'default',
            connectionId: 'default',
            storageScope: scope,
            useCustomReading: false,
            reading: {
                historyLimit: globalReading.historyLimit ?? 20,
                regexRules: [],
                disabledRegexIds: [],
                injectCharacterDescription: globalReading.injectCharacterDescription ?? true,
                injectUserDescription: globalReading.injectUserDescription ?? true,
                injectCharacterLorebook: globalReading.injectCharacterLorebook ?? true,
                injectGlobalLorebook: globalReading.injectGlobalLorebook ?? true,
                injectChatLorebook: globalReading.injectChatLorebook ?? true,
                lorebookExcludePrefixes: globalReading.lorebookExcludePrefixes ?? '',
                lorebookIncludeFilter: globalReading.lorebookIncludeFilter ?? '',
                customLorebookName: globalReading.customLorebookName ?? '',
                manuallySelectedEntries: globalReading.manuallySelectedEntries ? [...globalReading.manuallySelectedEntries] : [],
                summaryJsExpression: globalReading.summaryJsExpression ?? ''
            }
        };

        modes.push(newMode);
        extension_settings.plot.backstageModes = modes;
        set('backstageActiveModeId', newId);
        savePlotData();
        
        // Refresh & load new mode
        initModeSelector();
        loadConfigsIntoDrawer();
        switchConfigTab('mode');
    });

    // Delete Mode
    deleteModeBtn.addEventListener('click', () => {
        const activeId = get('backstageActiveModeId') || 'default';
        if (activeId === 'default') {
            alert('默认模式无法删除！');
            return;
        }
        if (!confirm('确定要删除当前幕后模式吗？所有与此模式绑定的对话历史也将清除。')) return;

        let modes = extension_settings.plot?.backstageModes || [];
        modes = modes.filter(m => m.id !== activeId);
        extension_settings.plot.backstageModes = modes;

        // Clear history
        set('backstageHistory', []);

        set('backstageActiveModeId', 'default');
        savePlotData();

        // Refresh & load default mode
        initModeSelector();
        loadConfigsIntoDrawer();
        switchConfigTab('mode');
    });    // 4. Tab 2: Context Reading Strategy & Custom Toggle
    const customReadingToggle = configDrawer.querySelector('#plot-bts-read-custom-toggle');
    const readingConfigContainer = configDrawer.querySelector('#plot-bts-read-config-container');

    customReadingToggle.addEventListener('change', () => {
        readingConfigContainer.style.display = customReadingToggle.checked ? 'flex' : 'none';
    });

    const customConnToggle = configDrawer.querySelector('#plot-bts-conn-custom-toggle');
    const connConfigContainer = configDrawer.querySelector('#plot-bts-conn-config-container');

    customConnToggle.addEventListener('change', () => {
        connConfigContainer.style.display = customConnToggle.checked ? 'flex' : 'none';
    });

    // Setup Accordions
    const setupAccordionSection = (hdrId, bodyId) => {
        const hdr = configDrawer.querySelector(`#${hdrId}`);
        const body = configDrawer.querySelector(`#${bodyId}`);
        // Clone and replace to clear old events
        const newHdr = hdr.cloneNode(true);
        hdr.parentNode.replaceChild(newHdr, hdr);
        
        newHdr.addEventListener('click', () => {
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : 'block';
            newHdr.classList.toggle('open', !isOpen);
        });
    };
    setupAccordionSection('plot-bts-acc-hdr-history', 'plot-bts-acc-body-history');
    setupAccordionSection('plot-bts-acc-hdr-persona', 'plot-bts-acc-body-persona');
    setupAccordionSection('plot-bts-acc-hdr-wi', 'plot-bts-acc-body-wi');
    setupAccordionSection('plot-bts-acc-hdr-wi-filter', 'plot-bts-acc-body-wi-filter');
    setupAccordionSection('plot-bts-acc-hdr-regex', 'plot-bts-acc-body-regex');
    setupAccordionSection('plot-bts-acc-hdr-other', 'plot-bts-acc-body-other');
    setupAccordionSection('plot-bts-theme-css-hdr', 'plot-bts-theme-css-body');

    // 5. Tab 3: Themes Mgr Bindings
    const themeMgrSelect = configDrawer.querySelector('#plot-bts-theme-mgr-select');
    const newThemeBtn = configDrawer.querySelector('#plot-bts-theme-new-btn');
    const deleteThemeBtn = configDrawer.querySelector('#plot-bts-theme-delete-btn');
    const themeNameInput = configDrawer.querySelector('#plot-bts-theme-name');

    const themeCssInput = configDrawer.querySelector('#plot-bts-theme-css');
    const cssFullscreenBtn = configDrawer.querySelector('#plot-bts-theme-css-fullscreen');
    if (cssFullscreenBtn) {
        cssFullscreenBtn.addEventListener('click', () => {
            const wrapper = configDrawer.querySelector('.plot-bts-css-wrapper');
            if (wrapper) {
                const isFullscreen = wrapper.classList.toggle('plot-bts-css-fullscreen-active');
                const span = cssFullscreenBtn.querySelector('span');
                const icon = cssFullscreenBtn.querySelector('i');
                if (isFullscreen) {
                    if (span) span.textContent = '退出全屏';
                    if (icon) {
                        icon.className = 'fa-solid fa-compress';
                    }
                    cssFullscreenBtn.title = '退出全屏编辑';
                } else {
                    if (span) span.textContent = '全屏';
                    if (icon) {
                        icon.className = 'fa-solid fa-expand';
                    }
                    cssFullscreenBtn.title = '全屏编辑';
                }
            }
        });
    }
    const themeFrameUrlInput = configDrawer.querySelector('#plot-bts-theme-frame-url');

    const customBotAvatarInput = configDrawer.querySelector('#plot-bts-custom-bot-avatar');
    const customUserAvatarInput = configDrawer.querySelector('#plot-bts-custom-user-avatar');

    const expBtn = configDrawer.querySelector('#plot-bts-theme-export');
    const impBtn = configDrawer.querySelector('#plot-bts-theme-import');
    const fileInput = configDrawer.querySelector('#plot-bts-theme-file-input');

    themeMgrSelect.addEventListener('change', () => {
        loadThemeInputs();
    });

    // Create Theme
    newThemeBtn.addEventListener('click', () => {
        const name = prompt('请输入新主题名称:');
        if (!name || !name.trim()) return;

        const themes = extension_settings.plot?.backstageThemes || [];
        const newId = 'theme_' + Date.now();
        const newTheme = {
            id: newId,
            name: name.trim(),
            customCss: '',
            avatarFrameUrl: ''
        };

        themes.push(newTheme);
        extension_settings.plot.backstageThemes = themes;
        savePlotData();

        themeMgrSelect.innerHTML += `<option value="${newId}">${escapeHtml(newTheme.name)}</option>`;
        themeMgrSelect.value = newId;
        loadThemeInputs();
    });

    // Delete Theme
    deleteThemeBtn.addEventListener('click', () => {
        const selectedId = themeMgrSelect.value;
        if (selectedId === 'default') return;
        if (!confirm('确定要删除此主题吗？')) return;

        let themes = extension_settings.plot?.backstageThemes || [];
        themes = themes.filter(t => t.id !== selectedId);
        extension_settings.plot.backstageThemes = themes;

        set('backstageActiveThemeId', 'default');
        savePlotData();
        applyThemeStyles();

        themeMgrSelect.innerHTML = `<option value="default" selected>默认主题 (跟随全局)</option>` + themes.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        loadThemeInputs();
        renderDialogue();
    });

    // Export Theme
    expBtn.addEventListener('click', () => {
        const selectedId = themeMgrSelect.value;
        const themes = extension_settings.plot?.backstageThemes || [];
        const theme = themes.find(t => t.id === selectedId);
        if (!theme) return;

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(theme, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `plot_theme_${theme.name.replace(/\s+/g, '_')}.json`);
        dlAnchorElem.click();
    });

    // Import Theme Trigger
    impBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const importedTheme = JSON.parse(evt.target.result);
                if (!importedTheme.name) {
                    alert('导入失败: 主题 JSON 文件格式无效');
                    return;
                }

                const themes = extension_settings.plot?.backstageThemes || [];
                importedTheme.id = 'theme_imported_' + Date.now();
                themes.push(importedTheme);
                extension_settings.plot.backstageThemes = themes;
                
                savePlotData();

                themeMgrSelect.innerHTML += `<option value="${importedTheme.id}">${escapeHtml(importedTheme.name)}</option>`;
                themeMgrSelect.value = importedTheme.id;
                loadThemeInputs();
                alert(`主题 "${importedTheme.name}" 导入成功！`);
            } catch (err) {
                alert('解析 JSON 失败: ' + err.message);
            }
        };
        reader.readAsText(file);
    });

    const loadThemeInputs = () => {
        const selectedId = themeMgrSelect.value;
        const themes = extension_settings.plot?.backstageThemes || [];
        const theme = themes.find(t => t.id === selectedId);

        if (selectedId === 'default' || !theme) {
            themeNameInput.value = '默认主题';
            themeNameInput.disabled = true;
            themeCssInput.value = '';
            themeCssInput.disabled = true;
            themeFrameUrlInput.value = '';
            themeFrameUrlInput.disabled = true;
            deleteThemeBtn.disabled = true;
            expBtn.disabled = true;
        } else {
            themeNameInput.value = theme.name;
            themeNameInput.disabled = false;
            themeCssInput.value = theme.customCss || '';
            themeCssInput.disabled = false;
            themeFrameUrlInput.value = theme.avatarFrameUrl || '';
            themeFrameUrlInput.disabled = false;
            deleteThemeBtn.disabled = false;
            expBtn.disabled = false;
        }
    };

    // Upgraded Category-Specific Cross-Lorebook Checklist Loading for Backstage
    const loadBtsWIEntriesChecklist = async (mode) => {
        const charContainer = rootEl.querySelector('#plot-bts-wi-char-container');
        const globalContainer = rootEl.querySelector('#plot-bts-wi-global-container');
        const chatContainer = rootEl.querySelector('#plot-bts-wi-chat-container');
        const customContainer = rootEl.querySelector('#plot-bts-wi-custom-container');

        if (!charContainer || !globalContainer || !chatContainer || !customContainer) return;

        const ctx = getContext();
        const char = ctx.characters?.[ctx.characterId];
        let charBookName = '';
        if (char) {
            const rawBook = char.data?.character_book || char.character_book;
            if (rawBook) {
                charBookName = rawBook.name || `${char.name}'s Lorebook`;
            }
        }
        const globalBooks = Array.isArray(selected_world_info) ? selected_world_info : [];
        
        const r = mode.reading || {};
        const customBookName = r.customLorebookName || '';
        r.manuallySelectedEntries = r.manuallySelectedEntries || [];
        const selectedKeys = r.manuallySelectedEntries;
        const loadWorldInfoFn = loadWorldInfo || ctx.loadWorldInfo;

        if (!loadWorldInfoFn) {
            console.error('[Plot] loadWorldInfo is not available in backstage');
            return;
        }

        // Toggle callback for WI entry checkboxes
        const onToggle = (keyStr, checked) => {
            if (!r.manuallySelectedEntries) r.manuallySelectedEntries = [];
            if (checked) {
                if (!r.manuallySelectedEntries.includes(keyStr)) {
                    r.manuallySelectedEntries.push(keyStr);
                }
            } else {
                r.manuallySelectedEntries = r.manuallySelectedEntries.filter(k => k !== keyStr);
            }
            savePlotData();
        };

        // 1. Character Book
        if (r.injectCharacterLorebook && charBookName) {
            await renderBookChecklist(charContainer, charBookName, '角色书', selectedKeys, loadWorldInfoFn, onToggle);
        } else {
            charContainer.innerHTML = '';
        }

        // 2. Global Books — load in parallel for performance
        if (r.injectGlobalLorebook && globalBooks.length > 0) {
            globalContainer.innerHTML = '';
            await Promise.all(globalBooks.map(name => {
                const bookDiv = document.createElement('div');
                globalContainer.appendChild(bookDiv);
                return renderBookChecklist(bookDiv, name, '全局书', selectedKeys, loadWorldInfoFn, onToggle);
            }));
        } else {
            globalContainer.innerHTML = '';
        }

        // 3. Chat Book
        const chatBookName = ctx.chatMetadata?.world_info || '';
        if (r.injectChatLorebook && chatBookName) {
            await renderBookChecklist(chatContainer, chatBookName, '聊天书', selectedKeys, loadWorldInfoFn, onToggle);
        } else {
            chatContainer.innerHTML = '';
        }

        // 4. Custom Book
        if (customBookName) {
            await renderBookChecklist(customContainer, customBookName, '独立书', selectedKeys, loadWorldInfoFn, onToggle);
        } else {
            customContainer.innerHTML = '';
        }
    };

    // Load configs from store/settings into unified config drawer fields
    const loadConfigsIntoDrawer = () => {
        const activeId = get('backstageActiveModeId') || 'default';
        const modes = extension_settings.plot?.backstageModes || [];
        const mode = modes.find(m => m.id === activeId);
        if (!mode) return;

        rootEl.querySelector('#plot-bts-mode-name').value = mode.name;
        const storageScopeSelect = rootEl.querySelector('#plot-bts-mode-storage-scope');
        storageScopeSelect.value = mode.storageScope || 'chat';
        storageScopeSelect.disabled = true;
        
        const presets = extension_settings.plot?.presets?.backstage || {};
        const presetSelect = rootEl.querySelector('#plot-bts-mode-preset');
        presetSelect.innerHTML = Object.entries(presets)
            .map(([id, p]) => `<option value="${id}" ${id === (mode.presetId || 'default') ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
            .join('');

        // Populate Connection Select and Toggle state
        const customConnToggle = configDrawer.querySelector('#plot-bts-conn-custom-toggle');
        const connConfigContainer = configDrawer.querySelector('#plot-bts-conn-config-container');
        customConnToggle.checked = !!mode.useCustomConnection;
        connConfigContainer.style.display = mode.useCustomConnection ? 'flex' : 'none';

        const connSelect = rootEl.querySelector('#plot-bts-mode-connection');
        const connections = listConnections() || [];
        connSelect.innerHTML = `<option value="default" ${'default' === (mode.connectionId || 'default') ? 'selected' : ''}>SillyTavern 默认连接</option>` +
            connections.map(c => `<option value="${c.id}" ${c.id === (mode.connectionId || 'default') ? 'selected' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.model)})</option>`).join('');

        // Pane 2: Reading Strategy
        customReadingToggle.checked = !!mode.useCustomReading;
        readingConfigContainer.style.display = mode.useCustomReading ? 'flex' : 'none';

        const r = mode.reading || {};
        rootEl.querySelector('#plot-bts-read-limit').value = r.historyLimit !== undefined ? r.historyLimit : 20;
        rootEl.querySelector('#plot-bts-read-char-desc').checked = !!r.injectCharacterDescription;
        rootEl.querySelector('#plot-bts-read-user-desc').checked = !!r.injectUserDescription;
        rootEl.querySelector('#plot-bts-read-wi-char').checked = !!r.injectCharacterLorebook;
        rootEl.querySelector('#plot-bts-read-wi-global').checked = !!r.injectGlobalLorebook;
        rootEl.querySelector('#plot-bts-read-wi-chat').checked = !!r.injectChatLorebook;
        rootEl.querySelector('#plot-bts-read-wi-exclude').value = r.lorebookExcludePrefixes || '';
        rootEl.querySelector('#plot-bts-read-wi-include').value = r.lorebookIncludeFilter || '';
        rootEl.querySelector('#plot-bts-read-summary').value = r.summaryJsExpression || '';

        // Populate Custom Worldbook Select
        const ctx = getContext();
        const worldNamesList = ctx.getWorldInfoNames ? ctx.getWorldInfoNames() : [];
        const customSelect = rootEl.querySelector('#plot-bts-read-wi-custom');
        customSelect.innerHTML = `
            <option value="">-- 选择独立注入世界书 --</option>
            ${worldNamesList.map(name => `<option value="${name}" ${r.customLorebookName === name ? 'selected' : ''}>${name}</option>`).join('')}
        `;

        // Render Regex Rules List
        populateRegexRules(mode);

        // Bind Add Regex Button
        const addRegexBtn = configDrawer.querySelector('#plot-bts-regex-add-btn');
        const newAddRegexBtn = addRegexBtn.cloneNode(true);
        addRegexBtn.parentNode.replaceChild(newAddRegexBtn, addRegexBtn);
        newAddRegexBtn.addEventListener('click', () => {
            showRegexEditorModal('专属规则', '', '', 'replace', (name, find, replace, action) => {
                if (!mode.reading.regexRules) mode.reading.regexRules = [];
                mode.reading.regexRules.push({
                    id: 'mode_rule_' + Date.now(),
                    name: name || '未命名规则',
                    find: find || '',
                    replace: replace || '',
                    action: action || 'replace',
                    disabled: false
                });
                populateRegexRules(mode);
            });
        });

        // Pane 3: Themes
        const themes = extension_settings.plot?.backstageThemes || [];
        const activeThemeId = get('backstageActiveThemeId') || 'default';
        themeMgrSelect.innerHTML = `<option value="default" ${activeThemeId === 'default' ? 'selected' : ''}>默认主题 (跟随全局)</option>` + themes.map(t => `<option value="${t.id}" ${t.id === activeThemeId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
        loadThemeInputs();

        // Pane 4: Global settings
        rootEl.querySelector('#plot-bts-avatar-option').value = get('backstageAvatarOption') || 'show';
        customBotAvatarInput.value = get('backstageCustomBotAvatar') || '';
        customUserAvatarInput.value = get('backstageCustomUserAvatar') || '';

        // Bind Change Events for WI Checkboxes and Select Dropdown to refresh checklist in real-time
        const replaceAndBind = (id, event, cb) => {
            const el = rootEl.querySelector(id);
            if (!el) return null;
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            newEl.addEventListener(event, cb);
            return newEl;
        };

        const newWiCharCheck = replaceAndBind('#plot-bts-read-wi-char', 'change', () => {
            r.injectCharacterLorebook = newWiCharCheck.checked;
            loadBtsWIEntriesChecklist(mode);
        });
        const newWiGlobalCheck = replaceAndBind('#plot-bts-read-wi-global', 'change', () => {
            r.injectGlobalLorebook = newWiGlobalCheck.checked;
            loadBtsWIEntriesChecklist(mode);
        });
        const newWiChatCheck = replaceAndBind('#plot-bts-read-wi-chat', 'change', () => {
            r.injectChatLorebook = newWiChatCheck.checked;
            loadBtsWIEntriesChecklist(mode);
        });
        const newWiCustomSelect = replaceAndBind('#plot-bts-read-wi-custom', 'change', () => {
            r.customLorebookName = newWiCustomSelect.value;
            loadBtsWIEntriesChecklist(mode);
        });

        // Initial load of checklist
        loadBtsWIEntriesChecklist(mode);

        currentBtsReloadWI = () => {
            loadBtsWIEntriesChecklist(mode);
        };

        // Subscribe to WI-related events — cancel any previous subscription first (fixes B8)
        if (_btsWiUnsubscribe) {
            _btsWiUnsubscribe();
            _btsWiUnsubscribe = null;
        }
        _btsWiUnsubscribe = subscribeWIRefresh(getContext(), () => {
            const container = rootEl?.querySelector('#plot-bts-wi-char-container');
            if (container && currentBtsReloadWI) {
                currentBtsReloadWI();
            }
        });
    };

    // 6. Unified Save Button
    saveBtn.addEventListener('click', async () => {
        closeFullscreen();
        const activeId = get('backstageActiveModeId') || 'default';
        const modes = extension_settings.plot?.backstageModes || [];
        const mode = modes.find(m => m.id === activeId);
        if (!mode) return;

        // 1. Save Mode info
        mode.name = rootEl.querySelector('#plot-bts-mode-name').value.trim() || '未命名模式';
        mode.presetId = rootEl.querySelector('#plot-bts-mode-preset').value;
        mode.useCustomConnection = customConnToggle.checked;
        mode.connectionId = rootEl.querySelector('#plot-bts-mode-connection').value;
        mode.storageScope = rootEl.querySelector('#plot-bts-mode-storage-scope').value;

        // 2. Save Reading Strategy
        mode.useCustomReading = customReadingToggle.checked;
        if (!mode.reading) mode.reading = {};
        const r = mode.reading;
        r.historyLimit = Number(rootEl.querySelector('#plot-bts-read-limit').value) || 0;
        r.injectCharacterDescription = rootEl.querySelector('#plot-bts-read-char-desc').checked;
        r.injectUserDescription = rootEl.querySelector('#plot-bts-read-user-desc').checked;
        r.injectCharacterLorebook = rootEl.querySelector('#plot-bts-read-wi-char').checked;
        r.injectGlobalLorebook = rootEl.querySelector('#plot-bts-read-wi-global').checked;
        r.injectChatLorebook = rootEl.querySelector('#plot-bts-read-wi-chat').checked;
        r.customLorebookName = rootEl.querySelector('#plot-bts-read-wi-custom').value;
        r.lorebookExcludePrefixes = rootEl.querySelector('#plot-bts-read-wi-exclude').value.trim();
        r.lorebookIncludeFilter = rootEl.querySelector('#plot-bts-read-wi-include').value.trim();
        r.summaryJsExpression = rootEl.querySelector('#plot-bts-read-summary').value.trim();

        // 3. Save Custom Theme fields
        const selectedThemeId = themeMgrSelect.value;
        const themes = extension_settings.plot?.backstageThemes || [];
        const theme = themes.find(t => t.id === selectedThemeId);

        if (selectedThemeId !== 'default' && theme) {
            theme.name = themeNameInput.value.trim() || '未命名主题';
            theme.customCss = themeCssInput.value;
            theme.avatarFrameUrl = themeFrameUrlInput.value.trim();
        }
        set('backstageActiveThemeId', selectedThemeId);

        // 4. Save Global Settings
        set('backstageAvatarOption', rootEl.querySelector('#plot-bts-avatar-option').value);

        // Save Custom Avatars
        set('backstageCustomBotAvatar', customBotAvatarInput.value.trim());
        set('backstageCustomUserAvatar', customUserAvatarInput.value.trim());
        // Apply theme styles, save settings and re-render
        await savePlotData();
        await loadPlotData(); // Reload history for the current mode/scope/thread!
        updateScopeIndicator(); // Update scope indicator icon on top bar
        initThreadSelector(); // Refresh thread list as scope or active mode could have changed
        applyThemeStyles();
        
        initModeSelector();
        renderDialogue();
        configDrawer.classList.remove('show');
    });
}

// ── Regex Rules list renderer inside drawer ──────────────────────────────────
function populateRegexRules(mode) {
    const listContainer = rootEl.querySelector('#plot-bts-mode-regex-list');
    listContainer.innerHTML = '';

    const getActionText = (rule) => {
        const act = rule.action || 'replace';
        if (act === 'delete') return '🗑️';
        if (act === 'keep') return '📌';
        return `&rarr; ${escapeHtml(rule.replace || '""')}`;
    };

    // 1. Get global rules
    const globalRules = extension_settings.plot?.reading?.regexRules || [];
    const disabledGlobalIds = mode.reading?.disabledRegexIds || [];

    // 2. Get mode-specific rules
    const modeRules = mode.reading?.regexRules || [];

    // Render Global rules
    globalRules.forEach((rule) => {
        const item = document.createElement('div');
        item.className = 'plot-regex-rule-row';
        item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px; padding:6px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85em;';
        
        const isChecked = !disabledGlobalIds.includes(rule.id);
        const actionLabel = rule.action === 'delete' ? '删除匹配' : (rule.action === 'keep' ? '仅保留匹配' : `替换: ${rule.replace || '""'}`);
        
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" class="plot-bts-regex-toggle" data-type="global" data-id="${rule.id}" ${isChecked ? 'checked' : ''}>
                <span style="font-weight:600;">${escapeHtml(rule.name)} <span style="font-size:0.8em; opacity:0.6;">(全局)</span></span>
            </div>
            <div style="font-size:0.8em; opacity:0.6; font-family:monospace; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="匹配: ${escapeHtml(rule.find)} | 操作: ${actionLabel}">
                ${escapeHtml(rule.find)} ${getActionText(rule)}
            </div>
        `;
        listContainer.appendChild(item);
    });

    // Render Mode-specific rules
    modeRules.forEach((rule, idx) => {
        const item = document.createElement('div');
        item.className = 'plot-regex-rule-row';
        item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px; padding:6px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85em;';
        
        const isChecked = !rule.disabled;
        const actionLabel = rule.action === 'delete' ? '删除匹配' : (rule.action === 'keep' ? '仅保留匹配' : `替换: ${rule.replace || '""'}`);
        
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" class="plot-bts-regex-toggle" data-type="mode" data-idx="${idx}" ${isChecked ? 'checked' : ''}>
                <span style="font-weight:600; color:var(--SmartThemeEmColor);">${escapeHtml(rule.name)} <span style="font-size:0.8em; opacity:0.6;">(模式专属)</span></span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <div style="font-size:0.8em; opacity:0.6; font-family:monospace; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="匹配: ${escapeHtml(rule.find)} | 操作: ${actionLabel}">
                    ${escapeHtml(rule.find)} ${getActionText(rule)}
                </div>
                <button class="plot-bts-action-btn plot-bts-regex-edit" data-idx="${idx}" title="编辑规则" style="padding:2px;"><i class="fa-solid fa-edit"></i></button>
                <button class="plot-bts-action-btn plot-bts-regex-delete" data-idx="${idx}" title="删除规则" style="padding:2px; color:var(--SmartThemeQuoteColor);"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(item);
    });

    // Bind checkbox toggles
    listContainer.querySelectorAll('.plot-bts-regex-toggle').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.dataset.type === 'global') {
                const ruleId = cb.dataset.id;
                let disabledIds = mode.reading.disabledRegexIds || [];
                if (!cb.checked) {
                    if (!disabledIds.includes(ruleId)) disabledIds.push(ruleId);
                } else {
                    disabledIds = disabledIds.filter(id => id !== ruleId);
                }
                mode.reading.disabledRegexIds = disabledIds;
            } else {
                const ruleIdx = Number(cb.dataset.idx);
                if (mode.reading.regexRules[ruleIdx]) {
                    mode.reading.regexRules[ruleIdx].disabled = !cb.checked;
                }
            }
        });
    });

    // Bind Edit for mode-specific rules
    listContainer.querySelectorAll('.plot-bts-regex-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const ruleIdx = Number(btn.dataset.idx);
            const rule = mode.reading.regexRules[ruleIdx];
            if (!rule) return;

            showRegexEditorModal(rule.name, rule.find, rule.replace, rule.action || 'replace', (newName, newFind, newReplace, newAction) => {
                rule.name = newName;
                rule.find = newFind;
                rule.replace = newReplace;
                rule.action = newAction;
                populateRegexRules(mode);
            });
        });
    });

    // Bind Delete for mode-specific rules
    listContainer.querySelectorAll('.plot-bts-regex-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const ruleIdx = Number(btn.dataset.idx);
            mode.reading.regexRules.splice(ruleIdx, 1);
            populateRegexRules(mode);
        });
    });
}

// ── Lightweight Input Modal ──────────────────────────────────────────────────
/**
 * Show a themed single-line input dialog that replaces native prompt().
 * @param {string}   title       - Dialog title text.
 * @param {string}   placeholder - Input placeholder text.
 * @param {function(string): void} onConfirm - Called with the trimmed input value on confirm.
 */
function showInputModal(title, placeholder, onConfirm) {
    let overlay = document.getElementById('plot-bts-input-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'plot-bts-input-modal-overlay';
        overlay.style.cssText = [
            'position:fixed; top:0; left:0; width:100vw; height:100vh;',
            'background-color:rgba(0,0,0,0.55);',
            'z-index:999999; display:flex; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;'
        ].join('');
        overlay.innerHTML = `
            <div style="width:340px; max-width:90vw; background:rgba(var(--SmartThemeBlurTintColor-rgb),1);
                border:1px solid var(--SmartThemeBorderColor); border-radius:8px; padding:18px;
                box-shadow:0 6px 24px rgba(0,0,0,0.35); display:flex; flex-direction:column; gap:14px;">
                <div style="font-weight:bold; color:var(--SmartThemeEmColor); font-size:0.95em;
                    border-bottom:1px solid var(--SmartThemeBorderColor); padding-bottom:8px;" id="plot-bts-input-modal-title"></div>
                <input type="text" id="plot-bts-input-modal-field" class="plot-input"
                    style="width:100%; box-sizing:border-box;">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button id="plot-bts-input-modal-cancel" class="plot-btn" style="font-size:0.85em; padding:4px 12px;">取消</button>
                    <button id="plot-bts-input-modal-confirm" class="plot-btn"
                        style="font-size:0.85em; padding:4px 12px;
                        border-color:var(--SmartThemeEmColor); color:var(--SmartThemeEmColor); font-weight:bold;">确认</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const titleEl   = overlay.querySelector('#plot-bts-input-modal-title');
    const field      = overlay.querySelector('#plot-bts-input-modal-field');
    const confirmBtn = overlay.querySelector('#plot-bts-input-modal-confirm');
    const cancelBtn  = overlay.querySelector('#plot-bts-input-modal-cancel');

    titleEl.textContent     = title;
    field.placeholder       = placeholder || '';
    field.value             = '';
    overlay.style.display   = 'flex';

    // Clone buttons to clear any previous event listeners
    const freshConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(freshConfirm, confirmBtn);
    const freshCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(freshCancel, cancelBtn);

    const close = () => { overlay.style.display = 'none'; };

    const doConfirm = () => {
        const value = field.value.trim();
        if (!value) {
            field.style.outline = '1px solid var(--SmartThemeQuoteColor)';
            setTimeout(() => { field.style.outline = ''; }, 1200);
            return;
        }
        close();
        onConfirm(value);
    };

    freshConfirm.addEventListener('click', doConfirm);
    freshCancel.addEventListener('click', close);
    field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doConfirm(); }
        if (e.key === 'Escape') close();
    });

    setTimeout(() => field.focus(), 50);
}

// ── Regex Editor Overlay Modal ───────────────────────────────────────────────
function showRegexEditorModal(initialName, initialFind, initialReplace, initialAction, onSave) {
    let overlay = document.getElementById('plot-bts-regex-modal-overlay');
    if (overlay) {
        overlay.remove();
    }

    overlay = document.createElement('div');
    overlay.id = 'plot-bts-regex-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(var(--SmartThemeBlurTintColor-rgb), 0.95);
        color: var(--SmartThemeBodyColor);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 15px;
        box-sizing: border-box;
    `;
    overlay.innerHTML = `
        <div style="width: 320px; background: var(--SmartThemeChatTintColor); border: 1px solid var(--SmartThemeBorderColor); border-radius: 8px; padding: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 10px;">
            <div style="font-weight: bold; color: var(--SmartThemeEmColor); border-bottom: 1px solid var(--SmartThemeBorderColor); padding-bottom: 6px; margin-bottom: 4px; font-size:0.95em;">编辑专属正则裁剪规则</div>
            <div class="plot-setting-group">
                <label class="plot-label" style="font-size: 0.8em;">规则名称</label>
                <input type="text" id="plot-bts-regex-m-name" class="plot-input" style="width:100%;">
            </div>
            <div class="plot-setting-group">
                <label class="plot-label" style="font-size: 0.8em;">匹配操作 (Action)</label>
                <select id="plot-bts-regex-m-action" class="plot-select" style="width:100%; padding: 4px 8px; font-size: 0.9em; cursor:pointer;">
                    <option value="replace">替换为自定义文本 (Replace)</option>
                    <option value="delete">裁剪/删除匹配内容 (Delete)</option>
                    <option value="keep">只保留匹配内容 (Keep Only)</option>
                </select>
            </div>
            <div class="plot-setting-group">
                <label class="plot-label" style="font-size: 0.8em;">匹配表达式 (Regex Find)</label>
                <input type="text" id="plot-bts-regex-m-find" class="plot-input" placeholder="/匹配内容/g" style="width:100%; font-family:monospace;">
            </div>
            <div class="plot-setting-group" id="plot-bts-regex-replace-group">
                <label class="plot-label" style="font-size: 0.8em;">替换为 (Replace With)</label>
                <input type="text" id="plot-bts-regex-m-replace" class="plot-input" placeholder="替换文本" style="width:100%;">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                <button id="plot-bts-regex-m-cancel" class="plot-btn" style="font-size:0.85em; padding:4px 10px;">取消</button>
                <button id="plot-bts-regex-m-save" class="plot-btn" style="font-size:0.85em; padding:4px 10px; border-color: var(--SmartThemeEmColor); color: var(--SmartThemeEmColor);">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector('#plot-bts-regex-m-name');
    const findInput = overlay.querySelector('#plot-bts-regex-m-find');
    const replaceInput = overlay.querySelector('#plot-bts-regex-m-replace');
    const actionSelect = overlay.querySelector('#plot-bts-regex-m-action');
    const replaceGroup = overlay.querySelector('#plot-bts-regex-replace-group');

    nameInput.value = initialName || '';
    findInput.value = initialFind || '';
    replaceInput.value = initialReplace || '';
    actionSelect.value = initialAction || 'replace';

    const updateReplaceVisibility = () => {
        if (actionSelect.value === 'delete' || actionSelect.value === 'keep') {
            replaceGroup.style.display = 'none';
        } else {
            replaceGroup.style.display = 'block';
        }
    };
    actionSelect.addEventListener('change', updateReplaceVisibility);
    updateReplaceVisibility();

    overlay.style.display = 'flex';

    const saveBtn = overlay.querySelector('#plot-bts-regex-m-save');
    const cancelBtn = overlay.querySelector('#plot-bts-regex-m-cancel');

    saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const find = findInput.value.trim();
        const replace = replaceInput.value;
        const action = actionSelect.value;

        if (!find) {
            alert('匹配表达式不能为空！');
            return;
        }

        onSave(name, find, replace, action);
        overlay.remove();
    });

    cancelBtn.addEventListener('click', () => {
        overlay.remove();
    });
}

// ── Chat & Dialogue Area ──────────────────────────────────────────────────────
function initChatInterface() {
    const sendBtn = rootEl.querySelector('#plot-bts-send-btn');
    const inputArea = rootEl.querySelector('#plot-bts-input');
    const clearBtn = rootEl.querySelector('#plot-bts-clear-btn');
    const dialogueArea = rootEl.querySelector('#plot-bts-dialogue-area');

    if (dialogueArea) {
        bindMessageActionsDelegated(dialogueArea);
    }

    // Autoresize input area height
    inputArea.addEventListener('input', () => {
        inputArea.style.height = 'auto';
        inputArea.style.height = (inputArea.scrollHeight - 4) + 'px';
    });

    // Send on click
    sendBtn.addEventListener('click', () => {
        sendMessage();
    });

    // Send on Enter (no Shift key)
    inputArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Clear history button
    clearBtn.addEventListener('click', () => {
        const activeModeId = get('backstageActiveModeId') || 'default';
        const modes = extension_settings.plot?.backstageModes || [];
        const mode = modes.find(m => m.id === activeModeId);
        const modeName = mode ? mode.name : '默认模式';

        if (!confirm(`确定要清空模式 "${modeName}" 的幕后副对话历史吗？`)) return;

        set('backstageHistory', []);
        savePlotData();
        renderDialogue();
    });
}

// Helper to safely get the current bot and user avatar URLs with proper fallbacks
function getDialogueAvatars() {
    const ctx = getContext();
    
    // 1. Get User Avatar
    let userAvatarUrl = get('backstageCustomUserAvatar') || '';
    if (!userAvatarUrl) {
        userAvatarUrl = '/img/user-default.png';
        const userAvatar = ctx.powerUserSettings?.user_avatar || ctx.chatMetadata?.persona;
        if (userAvatar && userAvatar !== 'none') {
            userAvatarUrl = ctx.getThumbnailUrl('persona', userAvatar);
        }
    }
    
    // 2. Get Bot Avatar
    let charAvatarUrl = get('backstageCustomBotAvatar') || '';
    if (!charAvatarUrl) {
        charAvatarUrl = '/img/ai4.png';
        const chId = ctx.characterId;
        if (chId !== undefined && ctx.characters[chId]) {
            const charAvatar = ctx.characters[chId].avatar;
            if (charAvatar && charAvatar !== 'none') {
                charAvatarUrl = ctx.getThumbnailUrl('avatar', charAvatar);
            }
        }
    }
    
    return { user: userAvatarUrl, bot: charAvatarUrl };
}

function renderDialogue() {
    const dialogueArea = rootEl.querySelector('#plot-bts-dialogue-area');
    if (!dialogueArea) return;

    const messages = get('backstageHistory') || [];

    if (messages.length === 0) {
        dialogueArea.innerHTML = `
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; opacity: 0.5; padding: 30px; text-align: center;">
                <i class="fa-solid fa-masks-theater" style="font-size: 3em; margin-bottom: 12px; color: var(--SmartThemeEmColor);"></i>
                <div style="font-size: 0.9em; font-weight: bold;">幕后副对话为空</div>
                <div style="font-size: 0.8em; margin-top: 4px;">输入消息并发送，探讨当前故事走向、背景和人物动机。</div>
            </div>
        `;
        return;
    }

    // Remove empty state placeholder if it exists and we have messages
    const emptyState = dialogueArea.querySelector('.fa-masks-theater');
    if (emptyState) {
        dialogueArea.innerHTML = '';
    }

    const avatarOption = get('backstageAvatarOption') || 'show';
    const showAvatar = avatarOption !== 'hide';
    const activeThemeId = get('backstageActiveThemeId') || 'default';
    const themes = extension_settings.plot?.backstageThemes || [];
    const theme = themes.find(t => t.id === activeThemeId);
    const frameUrl = theme?.avatarFrameUrl || '';

    // Fetch avatar assets via helper
    const avatars = getDialogueAvatars();

    // ── Incremental DOM reconciliation ──
    messages.forEach((msg, index) => {
        const isUser = msg.role === 'user';
        const swipes = msg.swipes || [msg.content || ''];
        const swipeId = msg.swipeId !== undefined ? msg.swipeId : 0;
        const activeContent = isUser ? msg.content : (swipes[swipeId] || '');

        let row = dialogueArea.children[index];

        // Unique signature for this message state (using fast template literal concatenation instead of slow JSON.stringify)
        const signature = `${msg.role}_${swipeId}_${swipes.length}_${showAvatar}_${frameUrl}_${avatars.user}_${avatars.bot}_${activeContent}`;

        // If row exists but signature changed (or it is not a message row), rebuild it
        if (row && (!row.classList.contains('plot-bts-msg-row') || row.dataset.signature !== signature)) {
            updateRowDOM(row, msg, index, activeContent, swipes, swipeId, showAvatar, avatars, frameUrl, signature);
        } else if (!row) {
            // Append a new row
            row = document.createElement('div');
            updateRowDOM(row, msg, index, activeContent, swipes, swipeId, showAvatar, avatars, frameUrl, signature);
            dialogueArea.appendChild(row);
        }
    });

    // Remove excess rows
    while (dialogueArea.children.length > messages.length) {
        dialogueArea.removeChild(dialogueArea.lastChild);
    }

    // Scroll to bottom
    setTimeout(() => {
        dialogueArea.scrollTop = dialogueArea.scrollHeight;
    }, 50);
}

// Helper to update a row element's classes, datasets, and internal content
function updateRowDOM(row, msg, index, activeContent, swipes, swipeId, showAvatar, avatars, frameUrl, signature) {
    row.className = `plot-bts-msg-row ${msg.role}`;
    row.dataset.index = index;
    row.dataset.signature = signature;

    // Render Avatar
    let avatarHtml = '';
    if (showAvatar) {
        const avatarUrl = msg.role === 'user' ? avatars.user : avatars.bot;
        const useFrame = frameUrl && msg.role === 'assistant';
        avatarHtml = `
            <div class="plot-bts-avatar-wrapper">
                ${useFrame ? `<div class="plot-bts-avatar-frame" style="background-image: url('${escapeHtml(frameUrl)}');"></div>` : ''}
                <img class="plot-bts-avatar" src="${avatarUrl}" alt="${msg.role}">
            </div>
        `;
    }

    // Render Actions Toolbar
    const actionsToolbar = `
        <div class="plot-bts-bubble-actions">
            ${msg.role === 'user' ? `
                <button class="plot-bts-action-btn plot-msg-edit" data-idx="${index}" title="编辑 (重发)"><i class="fa-solid fa-edit"></i></button>
                <button class="plot-bts-action-btn plot-msg-regenerate-user" data-idx="${index}" title="直接重新生成回复"><i class="fa-solid fa-arrows-rotate"></i></button>
            ` : `
                <button class="plot-bts-action-btn plot-msg-retry" data-idx="${index}" title="重roll (覆盖当前回复)"><i class="fa-solid fa-rotate-right"></i></button>
                <button class="plot-bts-action-btn plot-msg-swipe" data-idx="${index}" title="追加新回复 (Swipe)"><i class="fa-solid fa-arrows-left-right"></i></button>
            `}
            <button class="plot-bts-action-btn plot-msg-modify" data-idx="${index}" title="修改内容 (不重发)"><i class="fa-solid fa-pen"></i></button>
            <button class="plot-bts-action-btn plot-msg-delete" data-idx="${index}" title="删除消息"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;

    // Render Swipe Pagination if assistant
    let paginationHtml = '';
    if (msg.role === 'assistant' && swipes.length > 1) {
        paginationHtml = `
            <div class="plot-bts-swipe-indicators" style="display: flex; align-items: center; gap: 6px; font-size: 0.78em; white-space: nowrap; flex-shrink: 0; background: rgba(var(--SmartThemeBorderColor-rgb), 0.15); padding: 4px 8px; border-radius: 12px; height: fit-content; align-self: flex-end; margin-top: 4px; margin-right: 4px; user-select: none;">
                <span class="plot-bts-swipe-arrow plot-swipe-prev" data-idx="${index}" style="cursor: pointer; padding: 2px;" title="上一个"><i class="fa-solid fa-chevron-left"></i></span>
                <span style="color: var(--SmartThemeBodyColor); font-weight: bold;">${swipeId + 1} / ${swipes.length}</span>
                <span class="plot-bts-swipe-arrow plot-swipe-next" data-idx="${index}" style="cursor: pointer; padding: 2px;" title="下一个"><i class="fa-solid fa-chevron-right"></i></span>
            </div>
        `;
    }

    row.innerHTML = `
        ${avatarHtml}
        <div class="plot-bts-bubble-container" style="display: flex; flex-direction: column; gap: 4px;">
            <div class="plot-bts-bubble" style="position: relative;">
                <div class="plot-bts-bubble-text">${renderMessageContentCached(activeContent)}</div>
                ${actionsToolbar}
            </div>
            ${paginationHtml}
        </div>
    `;

    addCodeCopyButtons(row);
}

// Add copy buttons to all pre code elements in the message row
function addCodeCopyButtons(row) {
    const preEls = row.querySelectorAll('.plot-bts-bubble-text pre');
    preEls.forEach(pre => {
        if (pre.querySelector('.plot-code-copy-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'plot-code-copy-btn';
        btn.setAttribute('title', '复制代码');
        btn.innerHTML = '<i class="fa-solid fa-copy"></i>';

        btn.addEventListener('click', () => {
            const codeEl = pre.querySelector('code');
            const codeText = codeEl ? codeEl.innerText : pre.innerText;
            navigator.clipboard.writeText(codeText.trim()).then(() => {
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fa-solid fa-copy"></i>';
                }, 2000);
            }).catch(err => {
                console.error('[Plot] Failed to copy code: ', err);
            });
        });

        pre.appendChild(btn);
    });
}

// Bind bubble action clicks using event delegation on the container
function bindMessageActionsDelegated(area) {
    area.addEventListener('click', async (e) => {
        const messages = get('backstageHistory') || [];

        // 1. Delete message
        const deleteBtn = e.target.closest('.plot-msg-delete');
        if (deleteBtn) {
            const idx = Number(deleteBtn.dataset.idx);
            messages.splice(idx, 1);
            set('backstageHistory', messages);
            savePlotData();
            renderDialogue();
            return;
        }

        // 2. Modify message (direct text update without sending)
        const modifyBtn = e.target.closest('.plot-msg-modify');
        if (modifyBtn) {
            const idx = Number(modifyBtn.dataset.idx);
            const msg = messages[idx];
            if (!msg) return;

            const isUser = msg.role === 'user';
            const swipes = msg.swipes || [msg.content || ''];
            const swipeId = msg.swipeId !== undefined ? msg.swipeId : 0;
            const originalVal = isUser ? msg.content : swipes[swipeId];

            showBackstageEditModal('修改消息内容 (不重发)', originalVal, (newVal) => {
                if (isUser) {
                    msg.content = newVal;
                } else {
                    swipes[swipeId] = newVal;
                    msg.swipes = swipes;
                    msg.content = newVal; // fallback
                }

                set('backstageHistory', messages);
                savePlotData();
                renderDialogue();
            });
            return;
        }

        // 3. Edit message (Edit user message, resend, regenerate AI replies)
        const editBtn = e.target.closest('.plot-msg-edit');
        if (editBtn) {
            const idx = Number(editBtn.dataset.idx);
            const msg = messages[idx];
            if (!msg || msg.role !== 'user') return;

            showBackstageEditModal('编辑用户消息并重发', msg.content, (newVal) => {
                if (!newVal || !newVal.trim()) return;

                // Update user message and truncate all messages after it
                msg.content = newVal.trim();
                const truncatedHistory = messages.slice(0, idx + 1);
                
                set('backstageHistory', truncatedHistory);
                savePlotData();
                renderDialogue();

                // Resend
                executeAiGeneration(truncatedHistory);
            });
            return;
        }

        // 3.b Regenerate following replies directly from user message (no edit)
        const regenerateUserBtn = e.target.closest('.plot-msg-regenerate-user');
        if (regenerateUserBtn) {
            const idx = Number(regenerateUserBtn.dataset.idx);
            const msg = messages[idx];
            if (!msg || msg.role !== 'user') return;

            // Truncate all messages after this user message
            const truncatedHistory = messages.slice(0, idx + 1);

            set('backstageHistory', truncatedHistory);
            savePlotData();
            renderDialogue();

            // Resend
            executeAiGeneration(truncatedHistory);
            return;
        }

        // 4. Retry/Regenerate AI message (Re-roll, overwrite current swipe)
        const retryBtn = e.target.closest('.plot-msg-retry');
        if (retryBtn) {
            const idx = Number(retryBtn.dataset.idx);
            const msg = messages[idx];
            if (!msg || msg.role !== 'assistant') return;

            const precedingHistory = messages.slice(0, idx);
            if (precedingHistory.length === 0) return;

            // Trigger generation with isSwipeAction = false
            await executeAiGeneration(precedingHistory, msg, false);
            return;
        }

        // 4.b Swipe AI message (Generate new swipe option)
        const swipeBtn = e.target.closest('.plot-msg-swipe');
        if (swipeBtn) {
            const idx = Number(swipeBtn.dataset.idx);
            const msg = messages[idx];
            if (!msg || msg.role !== 'assistant') return;

            const precedingHistory = messages.slice(0, idx);
            if (precedingHistory.length === 0) return;

            // Trigger generation with isSwipeAction = true
            await executeAiGeneration(precedingHistory, msg, true);
            return;
        }

        // 5. Swipe navigation - Prev
        const prevBtn = e.target.closest('.plot-swipe-prev');
        if (prevBtn) {
            const idx = Number(prevBtn.dataset.idx);
            const msg = messages[idx];
            if (!msg || !msg.swipes) return;

            const swipeId = msg.swipeId !== undefined ? msg.swipeId : 0;
            if (swipeId > 0) {
                msg.swipeId = swipeId - 1;
                set('backstageHistory', messages);
                savePlotData();
                renderDialogue();
            }
            return;
        }

        // 6. Swipe navigation - Next
        const nextBtn = e.target.closest('.plot-swipe-next');
        if (nextBtn) {
            const idx = Number(nextBtn.dataset.idx);
            const msg = messages[idx];
            if (!msg || !msg.swipes) return;

            const swipeId = msg.swipeId !== undefined ? msg.swipeId : 0;
            if (swipeId < msg.swipes.length - 1) {
                msg.swipeId = swipeId + 1;
                set('backstageHistory', messages);
                savePlotData();
                renderDialogue();
            }
            return;
        }
    });
}

// ── Sending message and Async AI pipelines ────────────────────────────────────
async function sendMessage() {
    // Check if generating and send button is in "Stop" state FIRST!
    const sendBtn = rootEl.querySelector('#plot-bts-send-btn');
    if (sendBtn && sendBtn.classList.contains('stop')) {
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }
        return;
    }

    const inputArea = rootEl.querySelector('#plot-bts-input');
    const text = inputArea.value.trim();
    if (!text) return;

    // Clear text area
    inputArea.value = '';
    inputArea.style.height = 'auto';

    const messages = get('backstageHistory') || [];

    // Push new message with sender name for proper btsChatHistory serialisation (B8 Fix)
    const ctx = getContext();
    const userName = ctx.name1 || 'User';
    messages.push({
        id: 'msg_' + Date.now(),
        role: 'user',
        sender: userName,
        content: text,
        timestamp: Date.now()
    });

    set('backstageHistory', messages);
    savePlotData();
    renderDialogue();

    // Trigger Generation
    await executeAiGeneration(messages);
}

// Async AI pipeline executor
async function executeAiGeneration(chatLog, existingAiMsgToSwipe = null, isSwipeAction = false) {
    if (chatLog.length === 0) return;

    const activeModeId = get('backstageActiveModeId') || 'default';
    const modes = extension_settings.plot?.backstageModes || [];
    const mode = modes.find(m => m.id === activeModeId);
    if (!mode) return;

    const messages = get('backstageHistory') || [];

    // Toggle Send Button to Stop State
    const sendBtn = rootEl.querySelector('#plot-bts-send-btn');
    const sendIcon = rootEl.querySelector('#plot-bts-send-icon');
    sendBtn.classList.add('stop');
    sendBtn.title = '取消生成';
    sendIcon.className = 'fa-solid fa-stop';

    // Show Typing indicator
    const avatarOption = get('backstageAvatarOption') || 'show';
    const showAvatar = avatarOption !== 'hide';
    const activeThemeId = get('backstageActiveThemeId') || 'default';
    const themes = extension_settings.plot?.backstageThemes || [];
    const theme = themes.find(t => t.id === activeThemeId);
    const frameUrl = theme?.avatarFrameUrl || '';

    const avatars = getDialogueAvatars();
    const dialogueArea = rootEl.querySelector('#plot-bts-dialogue-area');
    const typingBubble = document.createElement('div');
    typingBubble.className = 'plot-bts-msg-row bot typing-indicator-row';
    
    let avatarHtml = '';
    if (showAvatar) {
        avatarHtml = `
            <div class="plot-bts-avatar-wrapper">
                ${frameUrl ? `<div class="plot-bts-avatar-frame" style="background-image: url('${escapeHtml(frameUrl)}');"></div>` : ''}
                <img class="plot-bts-avatar" src="${avatars.bot}" alt="assistant">
            </div>
        `;
    }

    typingBubble.innerHTML = `
        ${avatarHtml}
        <div class="plot-bts-bubble-container">
            <div class="plot-bts-bubble" style="background-color: var(--plot-bts-bot-bg, rgba(var(--SmartThemeBotMesBlurTintColor-rgb), 1)); color: var(--plot-bts-bot-text, var(--SmartThemeBodyColor)); border-top-left-radius: 2px;">
                <div class="plot-bts-typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    dialogueArea.appendChild(typingBubble);
    dialogueArea.scrollTop = dialogueArea.scrollHeight;

    // Build abort controller
    currentAbortController = new AbortController();

    try {
        // 1. Gather context and build prompt from workspace presets
        if (mode.presetId) {
            if (!extension_settings.plot.currentPreset) {
                extension_settings.plot.currentPreset = {};
            }
            extension_settings.plot.currentPreset.backstage = mode.presetId;
        }

        // Apply Custom Reading Strategy overrides if enabled
        const readingOverrides = {
            backstageHistory: chatLog
        };
        if (mode.useCustomReading && mode.reading) {
            // Filter global rules to exclude mode-disabled ones
            const globalRules = extension_settings.plot?.reading?.regexRules || [];
            const disabledGlobalIds = mode.reading?.disabledRegexIds || [];
            const activeGlobalRules = globalRules.filter(r => !disabledGlobalIds.includes(r.id));

            // Filter mode-specific rules
            const modeRules = mode.reading?.regexRules || [];
            const activeModeRules = modeRules.filter(r => !r.disabled);

            Object.assign(readingOverrides, {
                ...mode.reading,
                regexRules: [...activeGlobalRules, ...activeModeRules]
            });
        }

        const compiledContext = await buildContext(readingOverrides);
        const promptParts = assemblePrompt('backstage', compiledContext);

        // 2. Format chat history for AI completion payload
        const promptPayload = chatLog.map(m => {
            if (m.role === 'user') {
                return { role: 'user', content: m.content };
            } else {
                const swipes = m.swipes || [m.content || ''];
                const sId = m.swipeId !== undefined ? m.swipeId : 0;
                return { role: 'assistant', content: swipes[sId] || '' };
            }
        });

        // Check if any active block in the preset contains backstage history or user input macros
        const blocks = getBlocks('backstage', mode.presetId).filter(b => b.enabled);
        const hasMacro = blocks.some(b => 
            b.content && (
                b.content.includes('{{backstage_chat_history}}') || 
                b.content.includes('{{bts_chat_history}}') ||
                b.content.includes('{{backstage_user_input}}') ||
                b.content.includes('{{bts_user_input}}')
            )
        );

        let messagesToSend = [];
        if (hasMacro) {
            messagesToSend = promptParts.messages.map(m => ({ role: m.role, content: m.content }));
        } else {
            messagesToSend = [
                ...promptParts.messages.map(m => ({ role: m.role, content: m.content })),
                ...promptPayload
            ];
        }

        // 3. Make fetch request
        let reply = '';
        const isStream = extension_settings.plot?.streamModules?.backstage !== false;
        const connId = mode.useCustomConnection ? mode.connectionId : 'global';

        let textContainer = null;
        let tempRow = null;

        if (existingAiMsgToSwipe) {
            const idx = messages.indexOf(existingAiMsgToSwipe);
            if (idx !== -1) {
                const row = dialogueArea.children[idx];
                if (row) {
                    textContainer = row.querySelector('.plot-bts-bubble-text');
                    // Hide actions and pagination during stream
                    const indicators = row.querySelector('.plot-bts-swipe-indicators');
                    if (indicators) indicators.style.display = 'none';
                    const actions = row.querySelector('.plot-bts-bubble-actions');
                    if (actions) actions.style.display = 'none';
                }
            }
        }

        if (isStream) {
            // Remove typing indicator bubble
            typingBubble.remove();

            if (!textContainer) {
                // Render a temporary assistant message bubble to receive the streamed content
                tempRow = document.createElement('div');
                tempRow.className = `plot-bts-msg-row bot temp-stream-row`;
                
                let avatarHtml = '';
                if (showAvatar) {
                    avatarHtml = `
                        <div class="plot-bts-avatar-wrapper">
                            ${frameUrl ? `<div class="plot-bts-avatar-frame" style="background-image: url('${escapeHtml(frameUrl)}');"></div>` : ''}
                            <img class="plot-bts-avatar" src="${avatars.bot}" alt="assistant">
                        </div>
                    `;
                }

                tempRow.innerHTML = `
                    ${avatarHtml}
                    <div class="plot-bts-bubble-container">
                        <div class="plot-bts-bubble" style="background-color: var(--plot-bts-bot-bg, rgba(var(--SmartThemeBotMesBlurTintColor-rgb), 1)); color: var(--plot-bts-bot-text, var(--SmartThemeBodyColor)); border-top-left-radius: 2px;">
                            <div class="plot-bts-bubble-text"></div>
                        </div>
                    </div>
                `;
                dialogueArea.appendChild(tempRow);
                textContainer = tempRow.querySelector('.plot-bts-bubble-text');
            } else {
                // Clear old content to show streaming text
                textContainer.innerHTML = '';
            }

            const streamGen = callAIStream(messagesToSend, '', connId, currentAbortController.signal);
            
            let lastUpdateTime = 0;
            for await (const chunk of streamGen) {
                reply += chunk;
                const now = Date.now();
                if (now - lastUpdateTime > 80) {
                    if (textContainer) {
                        textContainer.innerHTML = renderMessageContent(reply);
                    }
                    dialogueArea.scrollTop = dialogueArea.scrollHeight;
                    lastUpdateTime = now;
                }
            }
            
            // Ensure the final stable content is rendered and cached
            if (textContainer) {
                textContainer.innerHTML = renderMessageContentCached(reply);
            }
            dialogueArea.scrollTop = dialogueArea.scrollHeight;
            
            if (tempRow) tempRow.remove();
        } else {
            const callPromise = callAI(messagesToSend, '', connId);
            const abortPromise = new Promise((_, reject) => {
                currentAbortController.signal.addEventListener('abort', () => reject(new Error('AbortError')));
            });

            reply = await Promise.race([callPromise, abortPromise]);
            typingBubble.remove();
            
            // For non-streaming, if we had a textContainer, update it temporarily and cache it
            if (textContainer) {
                textContainer.innerHTML = renderMessageContentCached(reply);
            }
        }

        // 4. Update dialogue history
        if (existingAiMsgToSwipe) {
            // Find existing message in message array and add Swipe
            const msgInHistory = messages.find(m => m.id === existingAiMsgToSwipe.id);
            if (msgInHistory) {
                if (!msgInHistory.swipes) msgInHistory.swipes = [msgInHistory.content || ''];
                if (isSwipeAction) {
                    msgInHistory.swipes.push(reply);
                    msgInHistory.swipeId = msgInHistory.swipes.length - 1;
                } else {
                    const swipeId = msgInHistory.swipeId !== undefined ? msgInHistory.swipeId : 0;
                    msgInHistory.swipes[swipeId] = reply;
                }
                msgInHistory.content = reply; // fallback
            }
        } else {
            // Create a new assistant reply message
            messages.push({
                id: 'msg_' + Date.now(),
                role: 'assistant',
                content: reply,
                swipes: [reply],
                swipeId: 0,
                timestamp: Date.now()
            });
        }

        set('backstageHistory', messages);
        await savePlotData();
        renderDialogue();

    } catch (err) {
        // B11 Fix: use a distinct variable name to avoid shadowing the outer 'tempRow'
        const orphanedTempRow = dialogueArea.querySelector('.temp-stream-row');
        if (orphanedTempRow) orphanedTempRow.remove();
        if (typingBubble && typingBubble.parentNode) typingBubble.remove();
        
        if (err.name === 'AbortError' || err.message === 'AbortError') {
            console.log('[Plot Backstage] AI generation aborted by user.');
        } else {
            console.error('[Plot Backstage] AI call failed:', err);
            alert('AI 调用失败: ' + err.message);
        }
    } finally {
        currentAbortController = null;
        sendBtn.classList.remove('stop');
        sendBtn.title = '发送 (Enter)';
        sendIcon.className = 'fa-solid fa-paper-plane';
    }
}

/**
 * Show a custom modal dialog to edit message content, styled to match ST themes.
 * @param {string} title
 * @param {string} initialText
 * @param {function(string)} onSave
 */
function showBackstageEditModal(title, initialText, onSave) {
    let overlay = document.getElementById('plot-bts-edit-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'plot-bts-edit-modal-overlay';
        document.body.appendChild(overlay);
    }
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.6);
        color: var(--SmartThemeBodyColor);
        z-index: 999999;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 15px;
        box-sizing: border-box;
    `;
    overlay.innerHTML = `
        <div style="
            width: 800px;
            max-width: 85vw;
            min-height: 60vh;
            max-height: 85vh;
            background-color: rgba(var(--SmartThemeBlurTintColor-rgb), 1);
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 8px;
            box-shadow: 0 0 15px var(--SmartThemeShadowColor);
            display: flex;
            flex-direction: column;
            padding: 16px;
            box-sizing: border-box;
            gap: 12px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--SmartThemeBorderColor); padding-bottom: 8px;">
                <h3 style="margin: 0; color: var(--SmartThemeEmColor); font-size: 1.05em; font-weight: bold;">${title}</h3>
                <i id="plot-bts-edit-modal-close" class="fa-solid fa-xmark" style="cursor: pointer; font-size: 1.2em; color: var(--SmartThemeEmColor); padding: 3px;"></i>
            </div>
            <textarea id="plot-bts-edit-modal-ta" class="plot-input"
                style="width: 100%; flex: 1; font-family: monospace; font-size: 0.95em; line-height: 1.5; background: var(--SmartThemeInputBgColor); color: var(--SmartThemeInputTextColor); border: 1px solid var(--SmartThemeInputBorderColor); border-radius: 4px; resize: vertical; padding: 10px; box-sizing: border-box; outline: none; margin-bottom: 4px;"></textarea>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <button id="plot-bts-edit-modal-cancel" class="menu_button plot-btn" style="padding: 4px 12px; font-size: 0.85em;">取消</button>
                <button id="plot-bts-edit-modal-save" class="menu_button plot-btn" style="padding: 4px 12px; font-size: 0.85em; background-color: rgba(var(--SmartThemeEmColor-rgb), 0.15); border-color: var(--SmartThemeEmColor); color: var(--SmartThemeEmColor); font-weight: bold;">确认</button>
            </div>
        </div>`;
    
    const ta = overlay.querySelector('#plot-bts-edit-modal-ta');
    ta.value = initialText;

    const close = () => { overlay.style.display = 'none'; };

    // B3 Fix: clone each button to strip any previously attached event listeners,
    // preventing handler accumulation when the modal is opened multiple times.
    const origCancel = overlay.querySelector('#plot-bts-edit-modal-cancel');
    const freshCancel = origCancel.cloneNode(true);
    origCancel.replaceWith(freshCancel);
    freshCancel.addEventListener('click', close);

    const origClose = overlay.querySelector('#plot-bts-edit-modal-close');
    const freshClose = origClose.cloneNode(true);
    origClose.replaceWith(freshClose);
    freshClose.addEventListener('click', close);

    const origSave = overlay.querySelector('#plot-bts-edit-modal-save');
    const freshSave = origSave.cloneNode(true);
    origSave.replaceWith(freshSave);
    freshSave.addEventListener('click', () => {
        const val = ta.value;
        onSave(val);
        close();
    });

    overlay.style.display = 'flex';
    ta.focus();
}
