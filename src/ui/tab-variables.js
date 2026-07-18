/**
 * tab-variables.js - Variables/World State UI Controller
 * Renders variable list in a status-bar-like HUD view (transparent, compact rows),
 * handles sorting (up/down chevron keys), visibility toggles (eye icon),
 * visual micro-sliders/switches/dropdowns, JSON modal editor, and batch parsing.
 */

import { getContext, renderExtensionTemplateAsync } from '../../../../../extensions.js';
import { get, set, subscribe } from '../core/store.js';
import { createVariable, deleteVariable, setVariable, evaluateTriggers } from '../core/variable-engine.js';
import { savePlotData } from '../core/storage.js';
import { createModuleConfigDrawer, getModuleModes, getActiveModeId, setActiveModeId, getActiveModeConfig } from './module-config-drawer.js';
import { listGoals } from '../core/goal-engine.js';
import { registerDynamicVariableMacros } from '../utils/macro.js';

let rootEl = null;
let triggerCompilers = []; // tracks functions to collect trigger configs in drawer
let currentJsonValue = {}; // tracks the current parsed JSON object/array being edited in modal

// Helper to escape HTML safely
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export async function renderVariablesTab(containerEl) {
    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/tab-variables');
    containerEl.innerHTML = html;
    rootEl = containerEl;

    // ── 1. Bind Drawer / Mode Manager ──
    const modeSelect = rootEl.querySelector('#plot-variables-mode-select');
    const settingsBtn = rootEl.querySelector('#plot-variables-settings-btn');

    const refreshModeDropdown = () => {
        const modes = getModuleModes('variables');
        const activeId = getActiveModeId('variables');
        modeSelect.innerHTML = modes.map(m => `<option value="${m.id}" ${m.id === activeId ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('');
    };

    refreshModeDropdown();

    const { show: showConfigDrawer } = createModuleConfigDrawer('variables', rootEl, async (newCfg) => {
        console.log('[Plot Variables] Configuration updated:', newCfg);
        refreshModeDropdown();
    });

    settingsBtn.addEventListener('click', () => {
        showConfigDrawer();
    });

    modeSelect.addEventListener('change', async () => {
        await setActiveModeId('variables', modeSelect.value);
        refreshModeDropdown();
        renderVariablesList();
    });

    // ── 2. Add / Clear / Filter Controls ──
    const addBtn = rootEl.querySelector('#plot-variables-add-btn');
    const clearAllBtn = rootEl.querySelector('#plot-variables-clear-all-btn');
    const showHiddenCheckbox = rootEl.querySelector('#plot-variables-show-hidden-checkbox');

    addBtn.addEventListener('click', () => {
        openConfigDrawer(null); // opens drawer in create mode
    });

    clearAllBtn.addEventListener('click', async () => {
        if (confirm("是否确定清空当前聊天的所有变量？此操作不可撤销！")) {
            set('variables', {});
            await savePlotData();
            renderVariablesList();
        }
    });

    showHiddenCheckbox.addEventListener('change', () => {
        renderVariablesList();
    });

    // ── 3. Import / Paste Parser Modal ──
    const importBtn = rootEl.querySelector('#plot-variables-import-btn');
    const importModal = rootEl.querySelector('#plot-variables-import-modal');
    const importClose = rootEl.querySelector('#plot-variables-import-close');
    const importTextarea = rootEl.querySelector('#plot-variables-import-textarea');
    const btnParse = rootEl.querySelector('#plot-variables-import-btn-parse');
    const btnSave = rootEl.querySelector('#plot-variables-import-btn-save');
    const previewGroup = rootEl.querySelector('#plot-variables-import-preview-group');
    const previewList = rootEl.querySelector('#plot-variables-import-preview-list');

    let parsedVariables = {};

    importBtn.addEventListener('click', () => {
        importTextarea.value = '';
        previewGroup.style.display = 'none';
        btnSave.style.display = 'none';
        parsedVariables = {};
        importModal.style.display = 'flex';
    });

    importClose.addEventListener('click', () => {
        importModal.style.display = 'none';
    });

    btnParse.addEventListener('click', () => {
        const text = importTextarea.value.trim();
        if (!text) {
            alert('请粘贴变量文本再点击解析！');
            return;
        }

        parsedVariables = {};
        let lines = [];

        try {
            const parsedJson = JSON.parse(text);
            const data = parsedJson.plot?.variables || parsedJson.variables || parsedJson;
            if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                for (const [key, val] of Object.entries(data)) {
                    let varObj = { id: key, name: key, type: 'text', value: val, defaultValue: val, visible: true, order: 0 };
                    if (typeof val === 'number') {
                        varObj.type = 'number';
                        varObj.min = 0;
                        varObj.max = Math.max(100, val * 2);
                    } else if (typeof val === 'boolean') {
                        varObj.type = 'boolean';
                    } else if (typeof val === 'object' && val !== null) {
                        varObj.type = 'json';
                    }
                    parsedVariables[key] = varObj;
                }
            }
        } catch (jsonErr) {
            lines = text.split('\n');
            lines.forEach((line, idx) => {
                const cleanLine = line.trim();
                if (!cleanLine || cleanLine.startsWith('//') || cleanLine.startsWith('#')) return;

                const match = cleanLine.match(/^([^:=]+)[:=](.+)$/);
                if (match) {
                    const key = match[1].trim();
                    const rawVal = match[2].trim();

                    let type = 'text';
                    let val = rawVal;

                    if (rawVal.toLowerCase() === 'true' || rawVal.toLowerCase() === 'false') {
                        type = 'boolean';
                        val = (rawVal.toLowerCase() === 'true');
                    } else if (!isNaN(Number(rawVal))) {
                        type = 'number';
                        val = Number(rawVal);
                    } else if ((rawVal.startsWith('{') && rawVal.endsWith('}')) || (rawVal.startsWith('[') && rawVal.endsWith(']'))) {
                        try {
                            val = JSON.parse(rawVal);
                            type = 'json';
                        } catch (e) {}
                    }

                    parsedVariables[key] = {
                        id: key,
                        name: key,
                        type: type,
                        value: val,
                        defaultValue: val,
                        visible: true,
                        order: idx,
                        min: type === 'number' ? 0 : undefined,
                        max: type === 'number' ? Math.max(100, typeof val === 'number' ? val * 2 : 100) : undefined
                    };
                }
            });
        }

        const keys = Object.keys(parsedVariables);
        if (keys.length === 0) {
            alert('未能解析出任何有效变量，请检查格式！');
            return;
        }

        previewList.innerHTML = keys.map(k => {
            const v = parsedVariables[k];
            const typeLabels = { number: '数值', boolean: '布尔', text: '文本', enum: '枚举', json: '复杂JSON' };
            const limitStr = v.type === 'number' ? ` (范围: ${v.min || 0} - ${v.max || 100})` : '';
            const valStr = v.type === 'json' ? JSON.stringify(v.value) : v.value;
            return `<div style="padding: 2px 0;"><strong>${escapeHtml(v.name)}</strong> [${typeLabels[v.type] || v.type}]: ${escapeHtml(valStr)}${limitStr}</div>`;
        }).join('');

        previewGroup.style.display = 'flex';
        btnSave.style.display = 'inline-block';
    });

    btnSave.addEventListener('click', async () => {
        const currentVars = { ...(get('variables') || {}) };
        const baseOrder = Object.keys(currentVars).length;
        Object.entries(parsedVariables).forEach(([key, v], idx) => {
            v.order = baseOrder + idx;
            currentVars[key] = v;
        });
        set('variables', currentVars);
        await savePlotData();
        importModal.style.display = 'none';
        renderVariablesList();
        evaluateTriggers();
    });

    // ── 4. Bind Config Drawer Cancel & Save ──
    const configDrawer = rootEl.querySelector('#plot-variable-config-drawer');
    const drawerClose = rootEl.querySelector('#plot-variable-drawer-close');
    const configCancel = rootEl.querySelector('#plot-variable-config-cancel');
    const configSave = rootEl.querySelector('#plot-variable-config-save');
    const typeSelect = rootEl.querySelector('#plot-drawer-var-type');
    const addTriggerBtn = rootEl.querySelector('#plot-drawer-add-trigger-btn');

    const hideDrawer = () => {
        configDrawer.classList.remove('show');
        setTimeout(() => { configDrawer.style.display = 'none'; }, 200);
    };

    drawerClose.addEventListener('click', hideDrawer);
    configCancel.addEventListener('click', hideDrawer);

    typeSelect.addEventListener('change', () => {
        const type = typeSelect.value;
        rootEl.querySelector('#plot-drawer-var-limits-group').style.display = type === 'number' ? 'flex' : 'none';
        rootEl.querySelector('#plot-drawer-var-choices-group').style.display = type === 'enum' ? 'block' : 'none';
        refreshDefaultValueInput(type);
    });

    configSave.addEventListener('click', async () => {
        const id = rootEl.querySelector('#plot-drawer-var-id').value.trim();
        const name = rootEl.querySelector('#plot-drawer-var-name').value.trim();
        const type = typeSelect.value;
        const desc = rootEl.querySelector('#plot-drawer-var-desc').value.trim();
        const injectTemplate = rootEl.querySelector('#plot-drawer-var-inject-template').value.trim();

        if (!id) {
            alert('变量标识 (ID/Key) 不能为空');
            return;
        }

        const vars = { ...(get('variables') || {}) };
        const isNew = !vars[id];

        let min = undefined;
        let max = undefined;
        let choices = [];

        if (type === 'number') {
            min = rootEl.querySelector('#plot-drawer-var-min').value !== '' ? Number(rootEl.querySelector('#plot-drawer-var-min').value) : undefined;
            max = rootEl.querySelector('#plot-drawer-var-max').value !== '' ? Number(rootEl.querySelector('#plot-drawer-var-max').value) : undefined;
        } else if (type === 'enum') {
            const rawChoices = rootEl.querySelector('#plot-drawer-var-choices').value;
            choices = rawChoices.split(',').map(c => c.trim()).filter(Boolean);
        }

        let defaultValue = '';
        const defaultEl = rootEl.querySelector('#plot-drawer-var-default');
        if (defaultEl) {
            if (type === 'number') {
                defaultValue = Number(defaultEl.value) || 0;
            } else if (type === 'boolean') {
                defaultValue = (defaultEl.value === 'true');
            } else if (type === 'json') {
                try {
                    defaultValue = JSON.parse(defaultEl.value || '{}');
                } catch (e) {
                    defaultValue = {};
                }
            } else {
                defaultValue = defaultEl.value;
            }
        }

        const triggers = triggerCompilers.map(fn => fn()).filter(Boolean);

        let currentVal = defaultValue;
        let currentOrder = isNew ? Object.keys(vars).length : (vars[id].order ?? Object.keys(vars).length);
        let currentVisible = isNew ? true : (vars[id].visible ?? true);

        if (!isNew && vars[id]) {
            currentVal = vars[id].value;
            if (type === 'number') {
                currentVal = Number(currentVal);
                if (min !== undefined) currentVal = Math.max(min, currentVal);
                if (max !== undefined) currentVal = Math.min(max, currentVal);
            }
        }

        vars[id] = {
            id,
            name: name || id,
            type,
            value: currentVal,
            defaultValue,
            min,
            max,
            choices,
            description: desc,
            injectLineTemplate: injectTemplate || undefined,
            triggers,
            order: currentOrder,
            visible: currentVisible
        };

        set('variables', vars);
        await savePlotData();
        registerDynamicVariableMacros();

        hideDrawer();
        renderVariablesList();

        document.dispatchEvent(new CustomEvent('plot:storeUpdated', {
            detail: { changed: { source: 'variable_config_saved', variableId: id } }
        }));
        evaluateTriggers();
    });

    addTriggerBtn.addEventListener('click', () => {
        const triggerListContainer = rootEl.querySelector('#plot-drawer-trigger-list');
        const rowObj = createTriggerRowDOM({}, triggerListContainer);
        triggerListContainer.appendChild(rowObj.dom);
        triggerCompilers.push(rowObj.getTriggerConfig);
    });

    // ── 5. Subscribe to Store updates ──
    const unsubscribe = subscribe('variables', () => {
        renderVariablesList();
    });

    const observer = new MutationObserver((mutations, obs) => {
        if (!document.body.contains(containerEl)) {
            unsubscribe();
            obs.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    renderVariablesList();
}

/**
 * Normalize variables `order` and `visible` properties
 */
function normalizeOrders(vars) {
    const list = Object.values(vars);
    let changed = false;

    list.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 99999;
        const orderB = b.order !== undefined ? b.order : 99999;
        if (orderA !== orderB) return orderA - orderB;
        return a.id.localeCompare(b.id);
    });

    list.forEach((v, idx) => {
        if (v.order !== idx) {
            v.order = idx;
            changed = true;
        }
        if (v.visible === undefined) {
            v.visible = true;
            changed = true;
        }
    });

    return changed;
}

/**
 * Handle variable order shifting (Up / Down)
 */
async function moveVariable(id, direction) {
    const vars = { ...(get('variables') || {}) };
    const list = Object.values(vars).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = list.findIndex(v => v.id === id);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
        const temp = list[idx].order;
        list[idx].order = list[idx - 1].order;
        list[idx - 1].order = temp;
    } else if (direction === 'down' && idx < list.length - 1) {
        const temp = list[idx].order;
        list[idx].order = list[idx + 1].order;
        list[idx + 1].order = temp;
    }

    set('variables', vars);
    await savePlotData();
    renderVariablesList();
}

/**
 * Toggle variable visibility state
 */
async function toggleVariableVisibility(id) {
    const vars = { ...(get('variables') || {}) };
    const v = vars[id];
    if (!v) return;

    v.visible = !(v.visible ?? true);

    set('variables', vars);
    await savePlotData();
    renderVariablesList();
}

/**
 * Replace default value input DOM depending on selected type
 */
function refreshDefaultValueInput(type, initialVal = '') {
    const container = rootEl.querySelector('#plot-drawer-var-default-container');
    if (!container) return;

    if (type === 'boolean') {
        container.innerHTML = `
            <select id="plot-drawer-var-default" class="plot-select" style="width: 100%;">
                <option value="false" ${initialVal === false ? 'selected' : ''}>false (否)</option>
                <option value="true" ${initialVal === true ? 'selected' : ''}>true (是)</option>
            </select>
        `;
    } else if (type === 'number') {
        container.innerHTML = `<input type="number" id="plot-drawer-var-default" class="plot-input" style="width: 100%;" value="${initialVal !== undefined ? initialVal : 0}">`;
    } else if (type === 'enum') {
        container.innerHTML = `<input type="text" id="plot-drawer-var-default" class="plot-input" style="width: 100%;" value="${initialVal || ''}" placeholder="必须是枚举选项之一">`;
    } else if (type === 'json') {
        const initialStr = typeof initialVal === 'object' ? JSON.stringify(initialVal) : initialVal;
        container.innerHTML = `
            <div style="display: flex; gap: 4px; align-items: center; width: 100%;">
                <input type="text" id="plot-drawer-var-default" class="plot-input" style="flex: 1; font-family: monospace; font-size: 0.85em;" value="${escapeHtml(initialStr || '{}')}" disabled>
                <button id="plot-drawer-var-default-edit-btn" class="plot-btn" style="padding: 4px 8px; flex-shrink: 0;" title="编辑默认 JSON 值"><i class="fa-solid fa-code"></i></button>
            </div>
        `;
        const editBtn = container.querySelector('#plot-drawer-var-default-edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const input = container.querySelector('#plot-drawer-var-default');
            let val = {};
            try { val = JSON.parse(input.value || '{}'); } catch(e) {}
            openJsonEditorModal(null, val, (newVal) => {
                input.value = JSON.stringify(newVal);
            });
        });
    } else {
        container.innerHTML = `<input type="text" id="plot-drawer-var-default" class="plot-input" style="width: 100%;" value="${initialVal || ''}">`;
    }
}

/**
 * Render all variables in a compact status-bar HUD list
 */
function renderVariablesList() {
    const cardContainer = rootEl.querySelector('#plot-variables-card-container');
    if (!cardContainer) return;

    const vars = { ...(get('variables') || {}) };

    // Normalize order index
    const varsChanged = normalizeOrders(vars);
    if (varsChanged) {
        set('variables', vars);
        savePlotData();
    }

    const list = Object.values(vars).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const showHiddenCheckbox = rootEl.querySelector('#plot-variables-show-hidden-checkbox');
    const showHidden = showHiddenCheckbox ? showHiddenCheckbox.checked : false;

    // Filter list
    const visibleList = list.filter(v => (v.visible !== false) || showHidden);

    if (visibleList.length === 0) {
        cardContainer.innerHTML = `<p style="padding:2em; text-align:center; opacity:0.5; font-size:0.9em; margin:0;">${showHidden ? '当前无注册变量' : '暂无可见变量（点击下方“显示已隐藏变量”或添加新变量）'}</p>`;
        return;
    }

    cardContainer.innerHTML = '';

    visibleList.forEach((v, idx) => {
        const id = v.id;
        const val = v.value;
        const isVisible = v.visible !== false;

        const row = document.createElement('div');
        row.className = 'plot-variable-row';
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 4px; border-bottom: 1px solid var(--SmartThemeBorderColor); gap: 10px; transition: background-color 0.15s; box-sizing: border-box;';
        
        if (!isVisible) {
            row.style.opacity = '0.45';
        }

        // Hover styling
        row.addEventListener('mouseenter', () => row.style.backgroundColor = 'rgba(255,255,255,0.02)');
        row.addEventListener('mouseleave', () => row.style.backgroundColor = 'transparent');

        // 1. Left Side: Sorting & Visibility Toggle & Variable Label
        const leftWrap = document.createElement('div');
        leftWrap.style.cssText = 'display: flex; align-items: center; gap: 4px; min-width: 0; flex: 1;';

        // Sorting arrows
        const sortWrap = document.createElement('div');
        sortWrap.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1; margin-right: 2px;';

        const upBtn = document.createElement('i');
        upBtn.className = 'fa-solid fa-chevron-up';
        upBtn.style.cssText = `cursor: pointer; opacity: 0.4; font-size: 0.68em; padding: 1px; transition: opacity 0.15s; ${idx === 0 ? 'pointer-events: none; opacity: 0.05;' : ''}`;
        upBtn.addEventListener('mouseenter', () => idx > 0 && (upBtn.style.opacity = '1'));
        upBtn.addEventListener('mouseleave', () => idx > 0 && (upBtn.style.opacity = '0.4'));
        upBtn.addEventListener('click', () => moveVariable(id, 'up'));
        sortWrap.appendChild(upBtn);

        const downBtn = document.createElement('i');
        downBtn.className = 'fa-solid fa-chevron-down';
        downBtn.style.cssText = `cursor: pointer; opacity: 0.4; font-size: 0.68em; padding: 1px; transition: opacity 0.15s; ${idx === visibleList.length - 1 ? 'pointer-events: none; opacity: 0.05;' : ''}`;
        downBtn.addEventListener('mouseenter', () => idx < visibleList.length - 1 && (downBtn.style.opacity = '1'));
        downBtn.addEventListener('mouseleave', () => idx < visibleList.length - 1 && (downBtn.style.opacity = '0.4'));
        downBtn.addEventListener('click', () => moveVariable(id, 'down'));
        sortWrap.appendChild(downBtn);

        leftWrap.appendChild(sortWrap);

        // Visibility Toggle eye icon
        const visToggle = document.createElement('i');
        visToggle.className = isVisible ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
        visToggle.style.cssText = 'cursor: pointer; opacity: 0.55; transition: opacity 0.15s; font-size: 0.82em; width: 15px; text-align: center; margin-right: 4px; flex-shrink: 0;';
        visToggle.title = isVisible ? '隐藏此变量' : '恢复可见';
        visToggle.addEventListener('mouseenter', () => visToggle.style.opacity = '1');
        visToggle.addEventListener('mouseleave', () => visToggle.style.opacity = '0.55');
        visToggle.addEventListener('click', () => toggleVariableVisibility(id));
        leftWrap.appendChild(visToggle);

        // Name
        const nameEl = document.createElement('strong');
        nameEl.textContent = v.name || id;
        nameEl.style.cssText = 'font-size: 0.88em; color: var(--SmartThemeEmColor); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;';
        leftWrap.appendChild(nameEl);

        const keyEl = document.createElement('span');
        keyEl.textContent = `(${id})`;
        keyEl.style.cssText = 'font-size: 0.7em; opacity: 0.35; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px; margin-left: 2px;';
        leftWrap.appendChild(keyEl);

        row.appendChild(leftWrap);

        // 2. Middle: Inline Value Controller
        const midWrap = document.createElement('div');
        midWrap.style.cssText = 'display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-shrink: 0; min-width: 120px;';

        const type = v.type || 'text';

        if (type === 'number') {
            const min = v.min ?? 0;
            const max = v.max ?? 100;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = min;
            slider.max = max;
            slider.value = val;
            slider.style.cssText = 'width: 70px; height: 3px; cursor: pointer; margin: 0; background: rgba(255,255,255,0.15); flex-shrink: 0;';

            const numInput = document.createElement('input');
            numInput.type = 'number';
            numInput.value = val;
            numInput.min = min;
            numInput.max = max;
            numInput.style.cssText = 'width: 32px; border: none; background: transparent; text-align: center; color: var(--SmartThemeEmColor); font-weight: bold; font-size: 0.85em; padding: 0; flex-shrink: 0;';

            const limitLabel = document.createElement('span');
            limitLabel.textContent = `/${max}`;
            limitLabel.style.cssText = 'font-size: 0.72em; opacity: 0.35; margin-left: -2px; flex-shrink: 0;';

            const updateVal = (newVal) => {
                let clamped = Math.max(min, Math.min(max, Number(newVal)));
                if (isNaN(clamped)) clamped = min;
                slider.value = clamped;
                numInput.value = clamped;
                setVariable(id, clamped);
            };

            slider.addEventListener('input', () => updateVal(slider.value));
            numInput.addEventListener('change', () => updateVal(numInput.value));

            midWrap.appendChild(slider);
            midWrap.appendChild(numInput);
            midWrap.appendChild(limitLabel);
        } else if (type === 'boolean') {
            const switchContainer = document.createElement('label');
            switchContainer.className = 'plot-switch';
            switchContainer.style.cssText = 'display: inline-block; width: 28px; height: 14px; position: relative; margin: 0; flex-shrink: 0;';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = !!val;
            chk.style.cssText = 'opacity: 0; width: 0; height: 0; margin: 0;';

            const slider = document.createElement('span');
            slider.style.cssText = `position: absolute; cursor: pointer; inset: 0; background-color: rgba(255,255,255,0.1); border: 1px solid var(--SmartThemeBorderColor); border-radius: 28px; transition: .2s; ${chk.checked ? 'background-color: var(--SmartThemeEmColor);' : ''}`;

            const knob = document.createElement('span');
            knob.style.cssText = `position: absolute; content: ""; height: 8px; width: 8px; left: 2px; bottom: 2px; background-color: var(--SmartThemeBodyColor); border-radius: 50%; transition: .2s; transform: ${chk.checked ? 'translateX(14px)' : 'none'};`;
            slider.appendChild(knob);

            chk.addEventListener('change', () => {
                knob.style.transform = chk.checked ? 'translateX(14px)' : 'none';
                slider.style.backgroundColor = chk.checked ? 'var(--SmartThemeEmColor)' : 'rgba(255,255,255,0.1)';
                setVariable(id, chk.checked);
            });

            switchContainer.appendChild(chk);
            switchContainer.appendChild(slider);
            midWrap.appendChild(switchContainer);
        } else if (type === 'enum') {
            const select = document.createElement('select');
            select.style.cssText = 'border: none; background: transparent; font-size: 0.85em; color: var(--SmartThemeEmColor); font-weight: bold; padding: 0 4px; cursor: pointer; max-width: 90px; text-overflow: ellipsis;';
            const choices = v.choices || [];

            if (choices.length === 0) {
                select.innerHTML = `<option value="${escapeHtml(val)}">${escapeHtml(val)}</option>`;
            } else {
                select.innerHTML = choices.map(c => `<option value="${escapeHtml(c)}" ${c === val ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
            }

            select.addEventListener('change', () => {
                setVariable(id, select.value);
            });

            midWrap.appendChild(select);
        } else if (type === 'json') {
            const countStr = Array.isArray(val) ? `${val.length}项` : `${Object.keys(val || {}).length}字段`;
            
            const summary = document.createElement('span');
            summary.style.cssText = 'font-size: 0.72em; font-family: monospace; opacity: 0.75; background: rgba(0,0,0,0.15); border: 1px solid var(--SmartThemeBorderColor); padding: 1px 4px; border-radius: 3px; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
            summary.textContent = countStr;
            
            const editValBtn = document.createElement('button');
            editValBtn.className = 'menu_button plot-btn';
            editValBtn.style.cssText = 'padding: 1px 4px; font-size: 0.72em; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: none; background: none; color: var(--SmartThemeEmColor);';
            editValBtn.innerHTML = '<i class="fa-solid fa-code"></i>';
            editValBtn.title = '编辑 JSON 变量的值';
            
            editValBtn.addEventListener('click', () => {
                openJsonEditorModal(id, val, (newVal) => {
                    setVariable(id, newVal);
                    renderVariablesList();
                });
            });
            
            midWrap.appendChild(summary);
            midWrap.appendChild(editValBtn);
        } else {
            // Text type
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.style.cssText = 'border: none; background: transparent; font-size: 0.85em; color: var(--SmartThemeEmColor); font-weight: bold; width: 90px; padding: 0; text-overflow: ellipsis; text-align: right;';
            textInput.value = val || '';

            textInput.addEventListener('change', () => {
                setVariable(id, textInput.value);
            });

            midWrap.appendChild(textInput);
        }

        row.appendChild(midWrap);

        // 3. Right Side: Settings & Delete icons
        const rightWrap = document.createElement('div');
        rightWrap.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-shrink: 0; width: 42px; justify-content: flex-end;';

        const gearIcon = document.createElement('i');
        gearIcon.className = 'fa-solid fa-gear';
        gearIcon.style.cssText = 'cursor: pointer; opacity: 0.35; transition: opacity 0.15s; font-size: 0.85em; padding: 2px;';
        gearIcon.title = '配置此变量触发器与详情';
        gearIcon.addEventListener('mouseenter', () => gearIcon.style.opacity = '1');
        gearIcon.addEventListener('mouseleave', () => gearIcon.style.opacity = '0.35');
        gearIcon.addEventListener('click', () => openConfigDrawer(id));
        rightWrap.appendChild(gearIcon);

        const trashIcon = document.createElement('i');
        trashIcon.className = 'fa-solid fa-trash-can';
        trashIcon.style.cssText = 'cursor: pointer; opacity: 0.35; transition: opacity 0.15s; color: var(--SmartThemeQuoteColor); font-size: 0.85em; padding: 2px;';
        trashIcon.title = '删除此变量';
        trashIcon.addEventListener('mouseenter', () => trashIcon.style.opacity = '1');
        trashIcon.addEventListener('mouseleave', () => trashIcon.style.opacity = '0.35');
        trashIcon.addEventListener('click', () => {
            if (confirm(`是否确认删除变量 ${nameEl.textContent} (${id})？`)) {
                deleteVariable(id);
                renderVariablesList();
            }
        });
        rightWrap.appendChild(trashIcon);

        row.appendChild(rightWrap);
        cardContainer.appendChild(row);
    });
}

/**
 * Open detail configuration drawer in Add/Edit mode
 */
function openConfigDrawer(varId = null) {
    const configDrawer = rootEl.querySelector('#plot-variable-config-drawer');
    const drawerTitle = configDrawer.querySelector('.plot-bts-drawer-title');
    const idInput = configDrawer.querySelector('#plot-drawer-var-id');
    const nameInput = configDrawer.querySelector('#plot-drawer-var-name');
    const typeSelect = configDrawer.querySelector('#plot-drawer-var-type');
    const descInput = configDrawer.querySelector('#plot-drawer-var-desc');
    const minInput = configDrawer.querySelector('#plot-drawer-var-min');
    const maxInput = configDrawer.querySelector('#plot-drawer-var-max');
    const choicesInput = configDrawer.querySelector('#plot-drawer-var-choices');
    const triggerListContainer = configDrawer.querySelector('#plot-drawer-trigger-list');

    triggerListContainer.innerHTML = '';
    triggerCompilers = [];

    if (varId) {
        const vars = get('variables') || {};
        const v = vars[varId];
        if (!v) return;

        drawerTitle.innerHTML = `<i class="fa-solid fa-gear"></i> 编辑变量: ${escapeHtml(v.name || varId)}`;
        idInput.value = varId;
        idInput.disabled = true;
        nameInput.value = v.name || varId;
        typeSelect.value = v.type || 'number';
        descInput.value = v.description || '';
        configDrawer.querySelector('#plot-drawer-var-inject-template').value = v.injectLineTemplate || '';

        minInput.value = v.min !== undefined ? v.min : '';
        maxInput.value = v.max !== undefined ? v.max : '';
        choicesInput.value = Array.isArray(v.choices) ? v.choices.join(', ') : '';

        const type = v.type || 'number';
        configDrawer.querySelector('#plot-drawer-var-limits-group').style.display = type === 'number' ? 'flex' : 'none';
        configDrawer.querySelector('#plot-drawer-var-choices-group').style.display = type === 'enum' ? 'block' : 'none';

        refreshDefaultValueInput(type, v.defaultValue);

        if (Array.isArray(v.triggers)) {
            v.triggers.forEach(tr => {
                const rowObj = createTriggerRowDOM(tr, triggerListContainer);
                triggerListContainer.appendChild(rowObj.dom);
                triggerCompilers.push(rowObj.getTriggerConfig);
            });
        }
    } else {
        drawerTitle.innerHTML = `<i class="fa-solid fa-plus"></i> 新建变量`;
        idInput.value = '';
        idInput.disabled = false;
        nameInput.value = '';
        typeSelect.value = 'number';
        descInput.value = '';
        configDrawer.querySelector('#plot-drawer-var-inject-template').value = '';
        minInput.value = '0';
        maxInput.value = '100';
        choicesInput.value = '';

        configDrawer.querySelector('#plot-drawer-var-limits-group').style.display = 'flex';
        configDrawer.querySelector('#plot-drawer-var-choices-group').style.display = 'none';

        refreshDefaultValueInput('number', 0);
    }

    configDrawer.style.display = 'flex';
    setTimeout(() => configDrawer.classList.add('show'), 10);
}

/**
 * Creates DOM node for a single Trigger card within Drawer
 */
function createTriggerRowDOM(trigger = {}, container) {
    const dom = document.createElement('div');
    dom.className = 'plot-drawer-trigger-card';
    dom.style.cssText = 'border: 1px solid var(--SmartThemeBorderColor); border-radius: 4px; padding: 8px; background: rgba(0,0,0,0.1); margin-bottom: 6px; display: flex; flex-direction: column; gap: 6px;';

    dom.innerHTML = `
        <div style="display: flex; gap: 6px; align-items: center;">
            <input type="text" class="plot-input trigger-condition" placeholder="条件 (如 value >= 80)" style="flex: 2; font-family: monospace; font-size: 0.82em; padding: 3px 6px;" value="${escapeHtml(trigger.condition || '')}">
            <select class="plot-select trigger-type" style="flex: 1; font-size: 0.8em; padding: 0 4px; height: 24px;">
                <option value="once" ${trigger.type === 'once' ? 'selected' : ''}>一次性触发</option>
                <option value="persistent" ${trigger.type === 'persistent' ? 'selected' : ''}>持续满足生效</option>
            </select>
            <i class="fa-solid fa-trash-can trigger-delete" style="cursor: pointer; color: var(--SmartThemeQuoteColor); font-size: 0.85em; padding: 0 4px;" title="删除此触发器"></i>
        </div>
        <div style="font-size: 0.78em; font-weight: bold; color: var(--SmartThemeEmColor); display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 4px;">
            <span>触发动作:</span>
            <button class="plot-btn add-trigger-action-btn" style="font-size: 0.72em; padding: 1px 4px;"><i class="fa-solid fa-plus"></i> 添加动作</button>
        </div>
        <div class="trigger-action-list" style="display: flex; flex-direction: column; gap: 4px;">
            <!-- Trigger actions go here -->
        </div>
    `;

    const actionListContainer = dom.querySelector('.trigger-action-list');
    const deleteBtn = dom.querySelector('.trigger-delete');
    const addActionBtn = dom.querySelector('.add-trigger-action-btn');

    let actionCompilers = [];

    deleteBtn.addEventListener('click', () => {
        dom.remove();
        const idx = triggerCompilers.indexOf(getTriggerConfig);
        if (idx !== -1) triggerCompilers.splice(idx, 1);
    });

    addActionBtn.addEventListener('click', () => {
        const actionRow = createTriggerActionRowDOM({}, actionListContainer, actionCompilers);
        actionListContainer.appendChild(actionRow.dom);
        actionCompilers.push(actionRow.getActionConfig);
    });

    if (Array.isArray(trigger.actions)) {
        trigger.actions.forEach(action => {
            const actionRow = createTriggerActionRowDOM(action, actionListContainer, actionCompilers);
            actionListContainer.appendChild(actionRow.dom);
            actionCompilers.push(actionRow.getActionConfig);
        });
    }

    function getTriggerConfig() {
        const condition = dom.querySelector('.trigger-condition').value.trim();
        if (!condition) return null;

        const type = dom.querySelector('.trigger-type').value;
        const actions = actionCompilers.map(fn => fn()).filter(Boolean);

        return {
            condition,
            type,
            fired: trigger.fired || false,
            active: trigger.active || false,
            actions
        };
    }

    return {
        dom,
        getTriggerConfig
    };
}

/**
 * Creates DOM node for a single Action row within a Trigger card
 */
function createTriggerActionRowDOM(action = {}, parentContainer, actionCompilersArray) {
    const dom = document.createElement('div');
    dom.className = 'plot-trigger-action-row';
    dom.style.cssText = 'display: flex; gap: 4px; align-items: center; width: 100%; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.02);';

    dom.innerHTML = `
        <select class="plot-select action-type" style="font-size: 0.78em; height: 22px; padding: 0 2px; flex-shrink: 0; width: 90px;">
            <option value="unlock_goal" ${action.type === 'unlock_goal' ? 'selected' : ''}>解锁目标</option>
            <option value="complete_goal" ${action.type === 'complete_goal' ? 'selected' : ''}>完成目标</option>
            <option value="fail_goal" ${action.type === 'fail_goal' ? 'selected' : ''}>失败目标</option>
            <option value="set_variable" ${action.type === 'set_variable' ? 'selected' : ''}>修改变量</option>
            <option value="inject_prompt" ${action.type === 'inject_prompt' ? 'selected' : ''}>注入提示词</option>
        </select>
        <div class="action-target-container" style="flex: 1; min-width: 80px; display: flex; align-items: center;">
            <!-- Dynamically populated target select or text input -->
        </div>
        <i class="fa-solid fa-trash-can action-delete" style="cursor: pointer; color: var(--SmartThemeQuoteColor); font-size: 0.8em; padding: 0 4px;" title="删除动作"></i>
    `;

    const typeSelect = dom.querySelector('.action-type');
    const targetContainer = dom.querySelector('.action-target-container');
    const deleteBtn = dom.querySelector('.action-delete');

    deleteBtn.addEventListener('click', () => {
        dom.remove();
        const idx = actionCompilersArray.indexOf(getActionConfig);
        if (idx !== -1) actionCompilersArray.splice(idx, 1);
    });

    const refreshActionTarget = () => {
        const type = typeSelect.value;
        targetContainer.innerHTML = '';

        if (type === 'unlock_goal' || type === 'complete_goal' || type === 'fail_goal') {
            const select = document.createElement('select');
            select.className = 'plot-select action-target';
            select.style.cssText = 'width: 100%; font-size: 0.78em; height: 22px; padding: 0 2px;';
            const goals = listGoals();

            if (goals.length === 0) {
                select.innerHTML = '<option value="">-- 无注册目标 --</option>';
            } else {
                select.innerHTML = goals.map(g => `<option value="${g.id}" ${action.target === g.id ? 'selected' : ''}>[${g.id}] ${escapeHtml(g.title)}</option>`).join('');
            }
            targetContainer.appendChild(select);
        } else if (type === 'set_variable') {
            const innerWrap = document.createElement('div');
            innerWrap.style.cssText = 'display: flex; gap: 3px; align-items: center; width: 100%;';

            const select = document.createElement('select');
            select.className = 'plot-select action-target';
            select.style.cssText = 'flex: 1; font-size: 0.78em; height: 22px; padding: 0 2px;';
            
            const vars = get('variables') || {};
            const keys = Object.keys(vars);
            if (keys.length === 0) {
                select.innerHTML = '<option value="">-- 无变量 --</option>';
            } else {
                select.innerHTML = keys.map(k => `<option value="${k}" ${action.target === k ? 'selected' : ''}>${escapeHtml(vars[k].name || k)}</option>`).join('');
            }
            innerWrap.appendChild(select);

            const opSelect = document.createElement('select');
            opSelect.className = 'plot-select action-op';
            opSelect.style.cssText = 'font-size: 0.75em; height: 22px; padding: 0 2px; width: 50px; flex-shrink: 0;';
            opSelect.innerHTML = `
                <option value="set" ${action.op === 'set' ? 'selected' : ''}>=</option>
                <option value="add" ${action.op === 'add' ? 'selected' : ''}>+</option>
                <option value="sub" ${action.op === 'sub' ? 'selected' : ''}>-</option>
                <option value="toggle" ${action.op === 'toggle' ? 'selected' : ''}>取反</option>
            `;
            innerWrap.appendChild(opSelect);

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'plot-input action-value';
            input.style.cssText = 'width: 40px; font-size: 0.78em; height: 22px; padding: 2px; text-align: center; flex-shrink: 0;';
            input.value = action.value !== undefined ? action.value : '';
            innerWrap.appendChild(input);

            opSelect.addEventListener('change', () => {
                input.style.display = opSelect.value === 'toggle' ? 'none' : 'block';
            });
            input.style.display = action.op === 'toggle' ? 'none' : 'block';

            targetContainer.appendChild(innerWrap);
        } else if (type === 'inject_prompt') {
            const innerWrap = document.createElement('div');
            innerWrap.style.cssText = 'display: flex; gap: 3px; align-items: center; width: 100%;';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'plot-input action-content';
            input.style.cssText = 'flex: 1; font-size: 0.78em; height: 22px; padding: 2px 4px;';
            input.value = action.content || '';
            input.placeholder = '输入提示词';
            innerWrap.appendChild(input);

            const select = document.createElement('select');
            select.className = 'plot-select action-mode';
            select.style.cssText = 'font-size: 0.75em; height: 22px; padding: 0 2px; width: 60px; flex-shrink: 0;';
            select.innerHTML = `
                <option value="system" ${action.mode === 'system' || !action.mode ? 'selected' : ''}>系统层</option>
                <option value="variable" ${action.mode === 'variable' ? 'selected' : ''}>变量尾</option>
            `;
            innerWrap.appendChild(select);

            targetContainer.appendChild(innerWrap);
        }
    };

    typeSelect.addEventListener('change', refreshActionTarget);
    refreshActionTarget();

    function getActionConfig() {
        const type = typeSelect.value;
        const targetEl = dom.querySelector('.action-target');

        const config = { type };

        if (type === 'unlock_goal' || type === 'complete_goal' || type === 'fail_goal') {
            config.target = targetEl ? targetEl.value : '';
        } else if (type === 'set_variable') {
            config.target = targetEl ? targetEl.value : '';
            config.op = dom.querySelector('.action-op')?.value || 'set';
            config.value = dom.querySelector('.action-value')?.value || '';
        } else if (type === 'inject_prompt') {
            config.content = dom.querySelector('.action-content')?.value || '';
            config.mode = dom.querySelector('.action-mode')?.value || 'system';
        }

        return config;
    }

    return {
        dom,
        getActionConfig
    };
}

// ── 6. JSON Dual-Mode Editor Modal Logic ──────────────────────────────────────

function openJsonEditorModal(varId, initialVal, onSaveCallback) {
    const modal = rootEl.querySelector('#plot-variables-json-modal');
    const titleEl = rootEl.querySelector('#plot-json-modal-title');
    const rawTextarea = rootEl.querySelector('#plot-json-raw-textarea');
    const errorMsg = rootEl.querySelector('#plot-json-raw-error-msg');

    currentJsonValue = JSON.parse(JSON.stringify(initialVal || {})); // Deep copy

    titleEl.innerHTML = `<i class="fa-solid fa-code"></i> 编辑 JSON 变量: ${varId ? escapeHtml(varId) : '默认配置'}`;

    const tabs = rootEl.querySelectorAll('#plot-json-tabs .plot-sub-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabs[0].classList.add('active'); // Visual Edit active

    rootEl.querySelector('#plot-json-pane-visual').style.display = 'flex';
    rootEl.querySelector('#plot-json-pane-raw').style.display = 'none';
    errorMsg.style.display = 'none';

    tabs.forEach(tab => {
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);

        newTab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            newTab.classList.add('active');

            const target = newTab.dataset.jsontab;
            if (target === 'visual') {
                const rawVal = rawTextarea.value.trim();
                try {
                    currentJsonValue = JSON.parse(rawVal || '{}');
                    errorMsg.style.display = 'none';
                    renderVisualTree();
                    rootEl.querySelector('#plot-json-pane-visual').style.display = 'flex';
                    rootEl.querySelector('#plot-json-pane-raw').style.display = 'none';
                } catch (e) {
                    errorMsg.textContent = `JSON格式错误: ${e.message}`;
                    errorMsg.style.display = 'block';
                    newTab.classList.remove('active');
                    rootEl.querySelector('[data-jsontab="raw"]').classList.add('active');
                }
            } else {
                rawTextarea.value = JSON.stringify(currentJsonValue, null, 2);
                rootEl.querySelector('#plot-json-pane-visual').style.display = 'none';
                rootEl.querySelector('#plot-json-pane-raw').style.display = 'flex';
            }
        });
    });

    const btnCancel = rootEl.querySelector('#plot-json-modal-cancel');
    const btnClose = rootEl.querySelector('#plot-variables-json-close');
    const btnSave = rootEl.querySelector('#plot-json-modal-save');
    const btnAdd = rootEl.querySelector('#plot-json-visual-add-btn');

    const closeModal = () => {
        modal.style.display = 'none';
    };

    btnCancel.onclick = closeModal;
    btnClose.onclick = closeModal;

    btnSave.onclick = () => {
        const activeTab = rootEl.querySelector('#plot-json-tabs .plot-sub-tab.active').dataset.jsontab;
        if (activeTab === 'raw') {
            const rawVal = rawTextarea.value.trim();
            try {
                currentJsonValue = JSON.parse(rawVal || '{}');
            } catch (e) {
                alert(`保存失败，JSON格式有误:\n${e.message}`);
                return;
            }
        } else {
            currentJsonValue = compileVisualTree();
        }

        onSaveCallback(currentJsonValue);
        closeModal();
    };

    btnAdd.onclick = () => {
        if (Array.isArray(currentJsonValue)) {
            currentJsonValue.push("");
        } else {
            let idx = 1;
            while (currentJsonValue[`key_${idx}`] !== undefined) idx++;
            currentJsonValue[`key_${idx}`] = "";
        }
        renderVisualTree();
    };

    renderVisualTree();
    modal.style.display = 'flex';
}

function renderVisualTree() {
    const container = rootEl.querySelector('#plot-json-visual-tree-container');
    if (!container) return;

    container.innerHTML = '';
    const isArr = Array.isArray(currentJsonValue);

    if (isArr) {
        if (currentJsonValue.length === 0) {
            container.innerHTML = '<p style="font-size:0.85em; text-align:center; opacity:0.5; padding:10px; margin:0;">空列表，点击右上角“添加字段”以增加子项</p>';
            return;
        }

        currentJsonValue.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'plot-json-visual-row';
            row.style.cssText = 'display: flex; gap: 6px; align-items: center; width: 100%; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.02);';

            const idxBadge = document.createElement('span');
            idxBadge.textContent = `[${idx}]`;
            idxBadge.style.cssText = 'font-size: 0.8em; opacity: 0.5; font-family: monospace; width: 30px; flex-shrink: 0;';
            row.appendChild(idxBadge);

            const isItemObj = typeof item === 'object' && item !== null;

            if (isItemObj) {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'plot-input json-item-val';
                input.style.cssText = 'flex: 1; font-family: monospace; font-size: 0.8em; height: 22px; padding: 2px 4px;';
                input.value = JSON.stringify(item);
                row.appendChild(input);

                const drillBtn = document.createElement('button');
                drillBtn.className = 'menu_button plot-btn';
                drillBtn.style.cssText = 'padding: 2px 6px; font-size: 0.72em; flex-shrink: 0;';
                drillBtn.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
                drillBtn.title = '钻取编辑此嵌套对象';
                drillBtn.addEventListener('click', () => {
                    openJsonEditorModal(`[${idx}]`, item, (newSubVal) => {
                        currentJsonValue[idx] = newSubVal;
                        renderVisualTree();
                    });
                });
                row.appendChild(drillBtn);
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'plot-input json-item-val';
                input.style.cssText = 'flex: 1; font-size: 0.85em; height: 22px; padding: 2px 4px;';
                input.value = String(item);
                row.appendChild(input);
            }

            const delBtn = document.createElement('button');
            delBtn.className = 'menu_button plot-btn';
            delBtn.style.cssText = 'padding: 2px 6px; font-size: 0.78em; color: var(--SmartThemeQuoteColor); flex-shrink: 0;';
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.addEventListener('click', () => {
                currentJsonValue.splice(idx, 1);
                renderVisualTree();
            });
            row.appendChild(delBtn);

            container.appendChild(row);
        });
    } else {
        const keys = Object.keys(currentJsonValue);
        if (keys.length === 0) {
            container.innerHTML = '<p style="font-size:0.85em; text-align:center; opacity:0.5; padding:10px; margin:0;">空对象，点击右上角“添加字段”以增加属性</p>';
            return;
        }

        keys.forEach((key, idx) => {
            const row = document.createElement('div');
            row.className = 'plot-json-visual-row';
            row.style.cssText = 'display: flex; gap: 6px; align-items: center; width: 100%; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.02);';

            const keyInput = document.createElement('input');
            keyInput.type = 'text';
            keyInput.className = 'plot-input json-item-key';
            keyInput.style.cssText = 'width: 90px; font-size: 0.82em; font-weight: bold; height: 22px; padding: 2px 4px; flex-shrink: 0;';
            keyInput.value = key;
            row.appendChild(keyInput);

            const colon = document.createElement('span');
            colon.textContent = ':';
            colon.style.cssText = 'opacity: 0.5; font-weight: bold;';
            row.appendChild(colon);

            const val = currentJsonValue[key];
            const isValObj = typeof val === 'object' && val !== null;

            if (isValObj) {
                const valInput = document.createElement('input');
                valInput.type = 'text';
                valInput.className = 'plot-input json-item-val';
                valInput.style.cssText = 'flex: 1; font-family: monospace; font-size: 0.8em; height: 22px; padding: 2px 4px;';
                valInput.value = JSON.stringify(val);
                row.appendChild(valInput);

                const drillBtn = document.createElement('button');
                drillBtn.className = 'menu_button plot-btn';
                drillBtn.style.cssText = 'padding: 2px 6px; font-size: 0.72em; flex-shrink: 0;';
                drillBtn.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
                drillBtn.title = '钻取编辑此嵌套对象';
                drillBtn.addEventListener('click', () => {
                    openJsonEditorModal(`.${key}`, val, (newSubVal) => {
                        currentJsonValue[key] = newSubVal;
                        renderVisualTree();
                    });
                });
                row.appendChild(drillBtn);
            } else {
                const valInput = document.createElement('input');
                valInput.type = 'text';
                valInput.className = 'plot-input json-item-val';
                valInput.style.cssText = 'flex: 1; font-size: 0.85em; height: 22px; padding: 2px 4px;';
                valInput.value = val !== undefined && val !== null ? String(val) : '';
                row.appendChild(valInput);
            }

            const delBtn = document.createElement('button');
            delBtn.className = 'menu_button plot-btn';
            delBtn.style.cssText = 'padding: 2px 6px; font-size: 0.78em; color: var(--SmartThemeQuoteColor); flex-shrink: 0;';
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.addEventListener('click', () => {
                delete currentJsonValue[key];
                renderVisualTree();
            });
            row.appendChild(delBtn);

            container.appendChild(row);
        });
    }
}

function compileVisualTree() {
    const isArr = Array.isArray(currentJsonValue);
    const rows = rootEl.querySelectorAll('#plot-json-visual-tree-container .plot-json-visual-row');

    if (isArr) {
        const newArr = [];
        rows.forEach(row => {
            const valInput = row.querySelector('.json-item-val');
            if (valInput) {
                const rawVal = valInput.value.trim();
                if ((rawVal.startsWith('{') && rawVal.endsWith('}')) || (rawVal.startsWith('[') && rawVal.endsWith(']'))) {
                    try {
                        newArr.push(JSON.parse(rawVal));
                    } catch (e) {
                        newArr.push(rawVal);
                    }
                } else {
                    if (rawVal.toLowerCase() === 'true') newArr.push(true);
                    else if (rawVal.toLowerCase() === 'false') newArr.push(false);
                    else if (!isNaN(Number(rawVal)) && rawVal !== '') newArr.push(Number(rawVal));
                    else newArr.push(rawVal);
                }
            }
        });
        return newArr;
    } else {
        const newObj = {};
        rows.forEach(row => {
            const keyInput = row.querySelector('.json-item-key');
            const valInput = row.querySelector('.json-item-val');
            if (keyInput && valInput) {
                const key = keyInput.value.trim();
                if (!key) return;

                const rawVal = valInput.value.trim();
                if ((rawVal.startsWith('{') && rawVal.endsWith('}')) || (rawVal.startsWith('[') && rawVal.endsWith(']'))) {
                    try {
                        newObj[key] = JSON.parse(rawVal);
                    } catch (e) {
                        newObj[key] = rawVal;
                    }
                } else {
                    if (rawVal.toLowerCase() === 'true') newObj[key] = true;
                    else if (rawVal.toLowerCase() === 'false') newObj[key] = false;
                    else if (!isNaN(Number(rawVal)) && rawVal !== '') newObj[key] = Number(rawVal);
                    else newObj[key] = rawVal;
                }
            }
        });
        return newObj;
    }
}
