/**
 * tab-settings.js - Global Settings & Help Tab
 *
 * Implements secondary tab bar (sub-tabs) with icons for:
 *   1. 面板与模块 (display & module toggles, accordion layout, collapsed by default)
 *   2. API 连接   (api connection config)
 *   3. 内容读取   (context reading strategy)
 *   4. 数据管理   (export / import)
 *   5. 教程说明   (help / tutorial content)
 *
 * Note: Prompt preset editing moved to main panel "提示词" tab (tab-prompts.js)
 */

import { getContext, renderExtensionTemplateAsync } from '../../../../../extensions.js';
import { selected_world_info, loadWorldInfo } from '../../../../../world-info.js';
import { showPanel, refreshTabVisibility } from './panel.js';
import { listConnections, saveConnection, deleteConnection, getConnection, fetchModels, testConnection, testConnectionById } from '../core/api-client.js';
import { exportPlotData, importPlotData, resetAllPlotData } from '../core/storage.js';
import { renderTutorial } from './tutorial.js';
import { renderBookChecklist, subscribeWIRefresh } from '../utils/dom.js';

const MODULE_NAME = 'plot';
let activeSubTabId = localStorage.getItem('plot_active_settings_sub_tab_id') || 'display';
let currentLoadWIEntriesChecklist = null;
let _wiUnsubscribe = null; // tracks the active WI event subscription

function getSettings() {
    const ctx = getContext();
    if (!ctx.extensionSettings[MODULE_NAME]) {
        ctx.extensionSettings[MODULE_NAME] = {};
    }
    return ctx.extensionSettings[MODULE_NAME];
}

function saveSettings() {
    getContext().saveSettingsDebounced?.();
}

// ── Sub Tab Renderer List ───────────────────────────────────────────────────

const SUB_TABS = [
    { id: 'display', icon: 'fa-cubes',            title: '面板与模块', render: renderDisplaySubTab },
    { id: 'api',     icon: 'fa-server',           title: 'API连接',   render: renderApiSubTab },
    { id: 'reading', icon: 'fa-filter',           title: '内容读取',   render: renderReadingSubTab },
    { id: 'data',    icon: 'fa-database',         title: '数据管理',   render: renderDataSubTab },
    { id: 'help',    icon: 'fa-circle-info',      title: '教程说明',   render: renderHelpSubTab }
];

// ── Sub Tab 1: Panel Display & Modules ───────────────────────────────────────

async function renderDisplaySubTab(container) {
    const settings = getSettings();
    if (!settings.panelPosition) settings.panelPosition = 'normal';
    if (!settings.panelSize)     settings.panelSize     = '80%';
    if (!settings.modules)       settings.modules       = {};

    const DEFAULT_GLOBAL_INJECT_TEMPLATE = '[剧情状态]\n{{goals}}\n[/剧情状态]';

    const modules = [
        { id: 'variables', label: '变量/状态系统' },
        { id: 'goals',     label: '目标系统'       },
        { id: 'storyline', label: '故事线管理'      },
        { id: 'backstage', label: '幕后'          },
        { id: 'logs',      label: '日志与测试'      },
    ];

    const moduleTogglesHtml = modules.map(mod => {
        const enabled = settings.modules[mod.id] !== false;
        return `
            <div class="plot-toggle-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span class="plot-label plot-no-shrink" style="font-weight:normal; font-size:0.9em;">${mod.label}</span>
                <label class="plot-switch">
                    <input type="checkbox" data-mod="${mod.id}" ${enabled ? 'checked' : ''}>
                    <span class="plot-switch-slider"></span>
                </label>
            </div>
        `;
    }).join('');

    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/settings-display');
    container.innerHTML = html;

    // Inject toggles list
    container.querySelector('#plot-toggle-list').innerHTML = moduleTogglesHtml;

    // Local Accordion Toggler
    const setupAccordion = (headerId, bodyId) => {
        const header = container.querySelector(`#${headerId}`);
        const body = container.querySelector(`#${bodyId}`);
        header.addEventListener('click', () => {
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : 'block';
            header.classList.toggle('open', !isOpen);
        });
    };

    setupAccordion('plot-header-display', 'plot-body-display');
    setupAccordion('plot-header-modules', 'plot-body-modules');
    setupAccordion('plot-header-global-inject', 'plot-body-global-inject');

    // Bind Position Select
    const posSelect = container.querySelector('#plot-panel-position');
    posSelect.value = settings.panelPosition;
    posSelect.addEventListener('change', () => {
        settings.panelPosition = posSelect.value;
        saveSettings();
    });

    // Bind Size Input
    const sizeInput = container.querySelector('#plot-panel-size');
    sizeInput.value = settings.panelSize;
    sizeInput.addEventListener('change', () => {
        const raw = sizeInput.value.trim();
        settings.panelSize = raw || '80%';
        sizeInput.value = settings.panelSize;
        saveSettings();
    });

    // Bind Preview Button
    container.querySelector('#plot-preview-panel').addEventListener('click', (e) => {
        e.stopPropagation();
        showPanel({
            position: settings.panelPosition,

            size: settings.panelSize
        });
    });

    // Bind Module Checkboxes
    container.querySelectorAll('input[data-mod]').forEach(cb => {
        cb.addEventListener('change', () => {
            settings.modules[cb.dataset.mod] = cb.checked;
            saveSettings();
            refreshTabVisibility();
        });
    });

    // Bind Global Injection Template textarea
    const globalTplArea = container.querySelector('#plot-global-injection-template');
    if (globalTplArea) {
        globalTplArea.value = settings.globalInjectionTemplate || DEFAULT_GLOBAL_INJECT_TEMPLATE;
        globalTplArea.addEventListener('change', () => {
            settings.globalInjectionTemplate = globalTplArea.value;
            saveSettings();
        });
        // Reset button
        container.querySelector('#plot-global-inject-reset')?.addEventListener('click', () => {
            settings.globalInjectionTemplate = DEFAULT_GLOBAL_INJECT_TEMPLATE;
            globalTplArea.value = DEFAULT_GLOBAL_INJECT_TEMPLATE;
            saveSettings();
        });
    }
}

// ── Sub Tab 2: API Connection Config (stub) ─────────────────────────────────

async function renderApiSubTab(container) {
    const settings = getSettings();
    if (!settings.defaultConnectionId) {
        settings.defaultConnectionId = 'default';
    }

    const connections = listConnections();

    // Generate connections options for selection
    const defaultSelectOptions = `
        <option value="default" ${settings.defaultConnectionId === 'default' ? 'selected' : ''}>SillyTavern 默认连接</option>
        ${connections.map(c => `
            <option value="${c.id}" ${settings.defaultConnectionId === c.id ? 'selected' : ''}>${c.name}</option>
        `).join('')}
    `;

    // Render connection list rows
    const listRows = connections.length === 0 
        ? `<div style="text-align:center; padding:15px; font-size:0.85em; color:var(--SmartThemeEmColor);">暂无自定义连接</div>`
        : connections.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid var(--SmartThemeBorderColor); font-size:0.9em;">
                <div>
                    <span style="font-weight:600; color:var(--SmartThemeBodyColor);">${c.name}</span>
                    <span style="font-size:0.8em; color:var(--SmartThemeEmColor); margin-left:8px;">
                        (${c.type === 'openai' ? 'OpenAI' : c.type === 'deepseek' ? 'DeepSeek' : 'OpenAI兼容'})
                    </span>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="menu_button plot-btn edit-conn-btn" data-id="${c.id}" style="padding:2px 8px; font-size:0.8em;"><i class="fa-solid fa-edit"></i></button>
                    <button class="menu_button plot-btn delete-conn-btn" data-id="${c.id}" style="padding:2px 8px; font-size:0.8em; color:var(--SmartThemeQuoteColor);"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');

    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/settings-connection');
    container.innerHTML = html;

    // Inject options & list
    const defaultSelect = container.querySelector('#plot-default-connection');
    defaultSelect.innerHTML = defaultSelectOptions;

    const connectionsList = container.querySelector('#plot-connections-list');
    connectionsList.innerHTML = listRows;

    // Bind Default Connection Select Change
    defaultSelect.addEventListener('change', () => {
        settings.defaultConnectionId = defaultSelect.value;
        saveSettings();
    });

    // Bind Default Connection Test Click
    const defaultTestBtn = container.querySelector('#plot-default-conn-test-btn');
    defaultTestBtn.addEventListener('click', async () => {
        const connId = defaultSelect.value;
        const origHtml = defaultTestBtn.innerHTML;
        defaultTestBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        defaultTestBtn.disabled = true;

        try {
            const reply = await testConnectionById(connId);
            alert(`连接成功！\nAI 回复内容: "${reply}"`);
        } catch (err) {
            alert(`连接测试失败！\n错误详情: ${err.message}`);
        } finally {
            defaultTestBtn.innerHTML = origHtml;
            defaultTestBtn.disabled = false;
        }
    });

    const formContainer = container.querySelector('#plot-conn-form-container');
    const formTitle = container.querySelector('#plot-conn-form-title');
    const formId = container.querySelector('#plot-conn-id');
    const formName = container.querySelector('#plot-conn-name');
    const formType = container.querySelector('#plot-conn-type');
    const formEndpoint = container.querySelector('#plot-conn-endpoint');
    const formKey = container.querySelector('#plot-conn-key');
    const formModel = container.querySelector('#plot-conn-model');
    const formModelSelect = container.querySelector('#plot-conn-model-select');
    const formTemp = container.querySelector('#plot-conn-temp');
    const formTokens = container.querySelector('#plot-conn-tokens');

    // Autofill endpoints based on connection type
    formType.addEventListener('change', () => {
        const val = formType.value;
        if (val === 'deepseek') {
            formEndpoint.value = 'https://api.deepseek.com/chat/completions';
            formModel.value = 'deepseek-chat';
        } else if (val === 'openai') {
            formEndpoint.value = 'https://api.openai.com/v1/chat/completions';
            formModel.value = 'gpt-4o-mini';
        } else if (val === 'openai-compat') {
            formEndpoint.value = 'http://localhost:5000/v1/chat/completions';
            formModel.value = 'local';
        }
        formModelSelect.style.display = 'none'; // reset select dropdown
    });

    // Show form on Add
    container.querySelector('#plot-add-conn-btn').addEventListener('click', () => {
        formTitle.textContent = '新建连接';
        formId.value = '';
        formName.value = '';
        formType.value = 'openai-compat';
        formEndpoint.value = 'http://localhost:5000/v1/chat/completions';
        formKey.value = '';
        formModel.value = 'local';
        formModelSelect.style.display = 'none';
        formTemp.value = '0.7';
        formTokens.value = '1000';
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth' });
    });

    // Edit connection
    container.querySelectorAll('.edit-conn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const conn = getConnection(btn.dataset.id);
            if (!conn) return;

            formTitle.textContent = '编辑连接';
            formId.value = conn.id;
            formName.value = conn.name || '';
            formType.value = conn.type || 'openai-compat';
            formEndpoint.value = conn.endpoint || '';
            formKey.value = conn.apiKey || '';
            formModel.value = conn.model || '';
            formModelSelect.style.display = 'none';
            formTemp.value = conn.temperature || '0.7';
            formTokens.value = conn.maxTokens || '1000';
            formContainer.style.display = 'block';
            formContainer.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Delete connection
    container.querySelectorAll('.delete-conn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('确认删除该连接吗？')) {
                deleteConnection(btn.dataset.id);
                renderApiSubTab(container); // Redraw
            }
        });
    });

    // Cancel form
    container.querySelector('#plot-conn-cancel').addEventListener('click', () => {
        formContainer.style.display = 'none';
    });

    // Pull Models list action
    container.querySelector('#plot-conn-pull-models').addEventListener('click', async () => {
        const ep = formEndpoint.value.trim();
        const key = formKey.value.trim();
        if (!ep) {
            alert('请先输入端点 Endpoint URL');
            return;
        }

        const pullBtn = container.querySelector('#plot-conn-pull-models');
        const origHtml = pullBtn.innerHTML;
        pullBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> 拉取中...';
        pullBtn.disabled = true;

        try {
            const models = await fetchModels(ep, key);
            if (models && models.length > 0) {
                formModelSelect.innerHTML = `<option value="">-- 选择模型 --</option>` + 
                    models.map(m => `<option value="${m}">${m}</option>`).join('');
                formModelSelect.style.display = 'block';
                // Automatically bind select change to model input
                formModelSelect.onchange = () => {
                    if (formModelSelect.value) {
                        formModel.value = formModelSelect.value;
                    }
                };
                alert(`成功获取到 ${models.length} 个模型！请在下拉列表中选择。`);
            } else {
                alert('获取成功，但模型列表为空。');
            }
        } catch (err) {
            alert('拉取模型失败: ' + err.message);
        } finally {
            pullBtn.innerHTML = origHtml;
            pullBtn.disabled = false;
        }
    });

    // Test Connection action
    container.querySelector('#plot-conn-test').addEventListener('click', async () => {
        const ep = formEndpoint.value.trim();
        const key = formKey.value.trim();
        const model = formModel.value.trim();

        if (!ep) {
            alert('请输入 API 端点 Endpoint URL');
            return;
        }

        const testBtn = container.querySelector('#plot-conn-test');
        const origHtml = testBtn.innerHTML;
        testBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 测试中...';
        testBtn.disabled = true;

        try {
            const reply = await testConnection(ep, key, model);
            alert(`连接成功！\nAI 回复内容: "${reply}"`);
        } catch (err) {
            alert(`连接测试失败！\n错误详情: ${err.message}`);
        } finally {
            testBtn.innerHTML = origHtml;
            testBtn.disabled = false;
        }
    });

    // Save form
    container.querySelector('#plot-conn-save').addEventListener('click', () => {
        const nameVal = formName.value.trim();
        const endpointVal = formEndpoint.value.trim();

        if (!nameVal) {
            alert('请输入连接名称');
            return;
        }
        if (!endpointVal) {
            alert('请输入 API 端点');
            return;
        }

        const config = {
            id: formId.value || undefined,
            name: nameVal,
            type: formType.value,
            endpoint: endpointVal,
            apiKey: formKey.value.trim(),
            model: formModel.value.trim() || 'default',
            temperature: parseFloat(formTemp.value) || 0.7,
            maxTokens: parseInt(formTokens.value, 10) || 1000
        };

        saveConnection(config);
        formContainer.style.display = 'none';
        renderApiSubTab(container); // Redraw list
    });
}

async function renderReadingSubTab(container) {
    const settings = getSettings();
    if (!settings.reading) {
        settings.reading = {
            historyLimit: 20,
            regexRules: [],
            injectCharacterDescription: true,
            injectUserDescription: true,
            injectCharacterLorebook: true,
            injectGlobalLorebook: true,
            injectChatLorebook: true,
            lorebookExcludePrefixes: '',
            lorebookIncludeFilter: '',
            customLorebookName: '',
            manuallySelectedEntries: [],
            summaryJsExpression: ''
        };
    }
    const r = settings.reading;
    r.regexRules = r.regexRules || [];
    r.manuallySelectedEntries = r.manuallySelectedEntries || [];

    // Get list of all available world info names from getContext()
    const ctx = getContext();
    const worldNamesList = ctx.getWorldInfoNames ? ctx.getWorldInfoNames() : [];
    const worldOptionsHtml = `
        <option value="">-- 选择独立注入世界书 --</option>
        ${worldNamesList.map(name => `
            <option value="${name}" ${r.customLorebookName === name ? 'selected' : ''}>${name}</option>
        `).join('')}
    `;

    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/settings-reading');
    container.innerHTML = html;

    // Inject custom select options
    const wiCustomSelect = container.querySelector('#plot-reading-wi-custom-select');
    wiCustomSelect.innerHTML = worldOptionsHtml;

    // Bind primary accordions fold/unfold
    const setupAccordionSection = (hdrId, bodyId) => {
        const hdr = container.querySelector(`#${hdrId}`);
        const body = container.querySelector(`#${bodyId}`);
        hdr.addEventListener('click', () => {
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : 'block';
            hdr.classList.toggle('open', !isOpen);
        });
    };
    setupAccordionSection('plot-read-hdr-chat', 'plot-read-body-chat');
    setupAccordionSection('plot-read-hdr-persona', 'plot-read-body-persona');
    setupAccordionSection('plot-read-hdr-wi', 'plot-read-body-wi');
    setupAccordionSection('plot-read-hdr-other', 'plot-read-body-other');

    // Bind secondary accordions: regex filters & world info filters
    setupAccordionSection('plot-read-hdr-regex', 'plot-read-body-regex');
    setupAccordionSection('plot-read-hdr-wi-filter', 'plot-read-body-wi-filter');

    // ── Bind Form Fields & Save ──
    const limitInput = container.querySelector('#plot-reading-limit');
    const charDescCheck = container.querySelector('#plot-reading-char-desc');
    const userDescCheck = container.querySelector('#plot-reading-user-desc');
    const wiCharCheck = container.querySelector('#plot-reading-wi-char');
    const wiGlobalCheck = container.querySelector('#plot-reading-wi-global');
    const wiChatCheck = container.querySelector('#plot-reading-wi-chat');
    const wiExcludeInput = container.querySelector('#plot-reading-wi-exclude');
    const wiIncludeInput = container.querySelector('#plot-reading-wi-include');
    const summaryExprInput = container.querySelector('#plot-reading-summary-expr');

    // Populate initial field values
    limitInput.value = r.historyLimit ?? 20;
    charDescCheck.checked = r.injectCharacterDescription !== false;
    userDescCheck.checked = r.injectUserDescription !== false;
    wiCharCheck.checked = r.injectCharacterLorebook !== false;
    wiGlobalCheck.checked = r.injectGlobalLorebook !== false;
    wiChatCheck.checked = r.injectChatLorebook !== false;
    wiExcludeInput.value = r.lorebookExcludePrefixes ?? '';
    wiIncludeInput.value = r.lorebookIncludeFilter ?? '';
    summaryExprInput.value = r.summaryJsExpression ?? '';

    const updateGeneralSettings = () => {
        r.historyLimit = parseInt(limitInput.value, 10) || 0;
        r.injectCharacterDescription = charDescCheck.checked;
        r.injectUserDescription = userDescCheck.checked;
        r.injectCharacterLorebook = wiCharCheck.checked;
        r.injectGlobalLorebook = wiGlobalCheck.checked;
        r.injectChatLorebook = wiChatCheck.checked;
        r.lorebookExcludePrefixes = wiExcludeInput.value.trim();
        r.lorebookIncludeFilter = wiIncludeInput.value.trim();
        r.summaryJsExpression = summaryExprInput.value.trim();
        r.customLorebookName = wiCustomSelect.value;
        saveSettings();
    };

    [limitInput, wiExcludeInput, wiIncludeInput, summaryExprInput].forEach(el => {
        el.addEventListener('input', updateGeneralSettings);
    });
    [charDescCheck, userDescCheck].forEach(el => {
        el.addEventListener('change', updateGeneralSettings);
    });

    const toggleWIList = () => {
        updateGeneralSettings();
        loadWIEntriesChecklist();
    };
    [wiCharCheck, wiGlobalCheck, wiChatCheck].forEach(el => {
        el.addEventListener('change', toggleWIList);
    });

    // ── Regex Rules List Rendering & Events ──
    const renderRegexRulesList = () => {
        const listContainer = container.querySelector('#plot-regex-rules-list');
        const rules = r.regexRules;
        if (rules.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; padding:10px; font-size:0.8em; color:var(--SmartThemeEmColor);">暂无自定义正则规则</div>`;
            return;
        }

        listContainer.innerHTML = rules.map((rule, idx) => `
            <div style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 8px; background: var(--SmartThemeChatTintColor); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <!-- Top Row: Name and Actions -->
                <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 6px;">
                    <input type="text" class="plot-input plot-regex-name" data-idx="${idx}" value="${rule.name || ''}" placeholder="规则名称" style="padding: 2px 6px; font-size: 0.85em; flex: 1; min-width: 100px; max-width: 150px;">
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <select class="plot-select plot-regex-action" data-idx="${idx}" style="padding: 2px 6px; font-size: 0.8em; width: 85px; height: 24px; cursor: pointer;">
                            <option value="replace" ${rule.action === 'replace' || !rule.action ? 'selected' : ''}>替换</option>
                            <option value="delete" ${rule.action === 'delete' ? 'selected' : ''}>删除</option>
                            <option value="keep" ${rule.action === 'keep' ? 'selected' : ''}>保留</option>
                        </select>
                        <label style="display: flex; align-items: center; gap: 4px; font-size: 0.8em; cursor: pointer; white-space: nowrap; user-select: none;">
                            <input type="checkbox" class="plot-regex-enable" data-idx="${idx}" ${!rule.disabled ? 'checked' : ''} style="margin: 0;">
                            启用
                        </label>
                        <button class="menu_button plot-btn plot-regex-del" data-idx="${idx}" style="padding: 2px 6px; font-size: 0.8em; color: var(--SmartThemeQuoteColor); display: flex; align-items: center; justify-content: center; height: 24px; border: 1px solid var(--SmartThemeBorderColor); border-radius: 4px;" title="删除此规则">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <!-- Bottom Row: Regular Expressions inputs -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 0.75em; opacity: 0.7;">匹配表达式 (Regex Find)</span>
                        <input type="text" class="plot-input plot-regex-find" data-idx="${idx}" value="${rule.find || ''}" placeholder="正则表达式" style="padding: 4px 8px; font-size: 0.85em; width: 100%; font-family: monospace;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px; ${rule.action === 'delete' || rule.action === 'keep' ? 'display: none;' : ''}">
                        <span style="font-size: 0.75em; opacity: 0.7;">替换为 (Replace With)</span>
                        <input type="text" class="plot-input plot-regex-replace" data-idx="${idx}" value="${rule.replace || ''}" placeholder="替换文本 (可空)" style="padding: 4px 8px; font-size: 0.85em; width: 100%;">
                    </div>
                </div>
            </div>
        `).join('');

        // Bind events
        listContainer.querySelectorAll('.plot-regex-name').forEach(el => {
            el.addEventListener('input', () => {
                rules[Number(el.dataset.idx)].name = el.value.trim();
                saveSettings();
            });
        });
        listContainer.querySelectorAll('.plot-regex-action').forEach(el => {
            el.addEventListener('change', () => {
                rules[Number(el.dataset.idx)].action = el.value;
                saveSettings();
                renderRegexRulesList();
            });
        });
        listContainer.querySelectorAll('.plot-regex-find').forEach(el => {
            el.addEventListener('input', () => {
                rules[Number(el.dataset.idx)].find = el.value.trim();
                saveSettings();
            });
        });
        listContainer.querySelectorAll('.plot-regex-replace').forEach(el => {
            el.addEventListener('input', () => {
                rules[Number(el.dataset.idx)].replace = el.value.trim();
                saveSettings();
            });
        });
        listContainer.querySelectorAll('.plot-regex-enable').forEach(el => {
            el.addEventListener('change', () => {
                rules[Number(el.dataset.idx)].disabled = !el.checked;
                saveSettings();
            });
        });
        listContainer.querySelectorAll('.plot-regex-del').forEach(el => {
            el.addEventListener('click', () => {
                rules.splice(Number(el.dataset.idx), 1);
                saveSettings();
                renderRegexRulesList();
            });
        });
    };

    container.querySelector('#plot-regex-add-btn').addEventListener('click', () => {
        r.regexRules.push({
            id: 'rule_' + Date.now(),
            name: `规则 ${r.regexRules.length + 1}`,
            find: '',
            replace: '',
            action: 'replace',
            disabled: false
        });
        saveSettings();
        renderRegexRulesList();
    });

    renderRegexRulesList();

    // ── WI Checklist ──
    const loadWIEntriesChecklist = async () => {
        const charContainer = container.querySelector('#plot-wi-char-container');
        const globalContainer = container.querySelector('#plot-wi-global-container');
        const chatContainer = container.querySelector('#plot-wi-chat-container');
        const customContainer = container.querySelector('#plot-wi-custom-container');

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
        const customBookName = r.customLorebookName || '';
        const loadWorldInfoFn = loadWorldInfo || ctx.loadWorldInfo;

        if (!loadWorldInfoFn) {
            console.error('[Plot] loadWorldInfo is not available');
            return;
        }

        // Toggle callback: update manuallySelectedEntries and save
        const onToggle = (keyStr, checked) => {
            if (!r.manuallySelectedEntries) r.manuallySelectedEntries = [];
            if (checked) {
                if (!r.manuallySelectedEntries.includes(keyStr)) {
                    r.manuallySelectedEntries.push(keyStr);
                }
            } else {
                r.manuallySelectedEntries = r.manuallySelectedEntries.filter(k => k !== keyStr);
            }
            saveSettings();
        };
        const selectedKeys = r.manuallySelectedEntries || [];

        // 1. Character Book
        if (r.injectCharacterLorebook && charBookName) {
            await renderBookChecklist(charContainer, charBookName, '角色书', selectedKeys, loadWorldInfoFn, onToggle);
        } else {
            charContainer.innerHTML = '';
        }

        // 2. Global Books — load in parallel
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
    currentLoadWIEntriesChecklist = loadWIEntriesChecklist;

    wiCustomSelect.addEventListener('change', () => {
        r.customLorebookName = wiCustomSelect.value;
        saveSettings();
        loadWIEntriesChecklist();
    });

    // Initial load
    loadWIEntriesChecklist();

    // Subscribe to WI-related events (replaces the old isEventBound pattern)
    // Cancel any previous subscription from a prior render of this tab
    if (_wiUnsubscribe) {
        _wiUnsubscribe();
        _wiUnsubscribe = null;
    }
    _wiUnsubscribe = subscribeWIRefresh(getContext(), () => {
        if (currentLoadWIEntriesChecklist && document.getElementById('plot-wi-char-container')) {
            currentLoadWIEntriesChecklist();
        }
    });
}

// ── Sub Tab 4: Data Management (export/import) ───────────────────────────────

async function renderDataSubTab(container) {
    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/settings-data');
    container.innerHTML = html;

    // Export: serialise current store data to JSON and trigger download
    container.querySelector('#plot-export-btn').addEventListener('click', () => {
        try {
            const jsonStr = exportPlotData();
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `plot_data_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('导出失败: ' + err.message);
        }
    });

    // Import: open file picker, parse JSON, load into store and save
    container.querySelector('#plot-import-btn').addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const success = await importPlotData(text);
                if (success) {
                    alert('导入成功！相关数据已更新。');
                } else {
                    alert('导入失败：JSON 数据格式错误或解析失败，请检查文件。');
                }
            } catch (err) {
                alert('导入失败: ' + err.message);
            }
        });
        fileInput.click();
    });

    // Reset All: double confirmation
    container.querySelector('#plot-reset-all-btn').addEventListener('click', async () => {
        const confirmed1 = confirm('确定要清空并重置剧情插件的一切数据（包含变量、目标、故事线、所有预设、连接和幕后历史等）吗？此操作不可逆！');
        if (!confirmed1) return;
        const confirmed2 = confirm('请再次确认：此操作将清除所有卡片的设定与本插件的历史记录。您确定要执行吗？');
        if (!confirmed2) return;
        
        try {
            await resetAllPlotData();
            alert('重置成功！插件数据已恢复到默认状态。即将刷新页面以应用更改。');
            location.reload();
        } catch (err) {
            alert('重置失败: ' + err.message);
        }
    });
}

// ── Sub Tab 5: Help & Tutorial ───────────────────────────────────────────────

function renderHelpSubTab(container) {
    renderTutorial(container);
}

// ── Main Tab View Render ─────────────────────────────────────────────────────

export function renderSettingsTab(containerEl) {
    containerEl.innerHTML = '';

    // 1. Create Sub Tab Bar
    const subTabBar = document.createElement('div');
    subTabBar.className = 'plot-sub-tab-bar';

    SUB_TABS.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = 'plot-sub-tab' + (tab.id === activeSubTabId ? ' active' : '');
        btn.innerHTML = '<i class="fa-solid ' + tab.icon + '"></i>';
        btn.title = tab.title;
        btn.dataset.subtab = tab.id;
        btn.addEventListener('click', () => switchSubTab(tab.id, paneWrapper));
        subTabBar.appendChild(btn);
    });

    containerEl.appendChild(subTabBar);

    // 2. Create Sub Tab Pane Wrapper
    const paneWrapper = document.createElement('div');
    paneWrapper.style.flex = '1';
    paneWrapper.style.overflowY = 'auto';
    paneWrapper.id = 'plot-sub-pane-wrapper';

    containerEl.appendChild(paneWrapper);

    // Initial render
    switchSubTab(activeSubTabId, paneWrapper);
}

function switchSubTab(subTabId, wrapperEl) {
    activeSubTabId = subTabId;
    localStorage.setItem('plot_active_settings_sub_tab_id', subTabId);

    // Update active sub-tab buttons
    document.querySelectorAll('.plot-sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtab === subTabId);
    });

    // Render active content
    const activeTabObj = SUB_TABS.find(t => t.id === subTabId);
    if (activeTabObj) {
        wrapperEl.innerHTML = '';
        activeTabObj.render(wrapperEl);
    }
}
