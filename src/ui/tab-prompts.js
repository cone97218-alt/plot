/**
 * tab-prompts.js - Prompt Workspace (main panel)
 *
 * Block-centric editor: all prompt editing is done through prompt blocks.
 * Each block has: role (system/user/assistant), name, content, enabled, order.
 * Built-in blocks can be disabled or reset; custom blocks can be fully managed.
 *
 * Module tabs: 总模板 | 变量模块 | 目标模块 | 故事线模块 | 幕后
 *   - 总模板: shows only the two global blocks (global_system + global_user)
 *   - Module tabs: show global blocks + module-specific blocks (full assembly chain)
 *
 * Preset bar: per-module preset switcher (new / rename / delete / import / export)
 */

import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../../../extensions.js';
import { getBlocks, saveBlock, deleteBlock, resetBlock, assemblePrompt } from '../core/prompt-builder.js';
import { buildContext } from '../core/context-reader.js';

const MODULE_NAME = 'plot';
let lastFocusedTextarea = null;
let activeRenderBlockList = null;

// Helper to escape HTML safely
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const MODULES = [
    { id: 'variables', label: '变量判定',   desc: '变量判定模块的提示词配置' },
    { id: 'goals',     label: '目标判定',   desc: '目标达成判定模块的提示词配置' },
    { id: 'goals_ai_gen', label: '目标生成', desc: '目标智能自动生成模块的提示词配置' },
    { id: 'storyline', label: '故事线判定', desc: '故事线进度分析模块的提示词配置' },
    { id: 'backstage', label: '幕后生成',   desc: '幕后交互与生成模块的提示词配置' },
];

const PLACEHOLDERS = {
    variables:  [
        { key: '{{plot_variables}}', desc: '当前所有已注册变量键值列表' },
        { key: '{{chat_history}}',   desc: '对话历史' },
    ],
    goals:      [
        { key: '{{plot_goals_active}}',   desc: '当前进行中/活跃的目标列表' },
        { key: '{{chat_history}}', desc: '对话历史' },
    ],
    goals_ai_gen: [
        { key: '{{char_desc}}',    desc: '角色设定描述' },
        { key: '{{user_desc}}',    desc: '用户 Persona 描述' },
        { key: '{{world_info}}',   desc: '世界书设定' },
        { key: '{{chat_history}}', desc: '对话历史' },
        { key: '{{summary}}',      desc: '对话总结' },
    ],
    storyline:  [
        { key: '{{plot_storyline}}', desc: '当前激活故事线阶段信息' },
        { key: '{{chat_history}}',     desc: '对话历史' },
    ],
    backstage:  [
        { key: '{{author_command}}',  desc: '幕后输入的干预文本' },
        { key: '{{context_summary}}', desc: '当前核心状态汇总摘要' },
        { key: '{{backstage_user_input}}', desc: '幕后模块用户的最新输入' },
        { key: '{{backstage_chat_history}}', desc: '幕后模块的本地对话历史' },
    ],
};

// ── Preset helpers (same defaults as prompt-builder built-ins) ─────────────────

const DEFAULT_PRESETS = {
    global:    { 'default': { name: '默认预设' } },
    variables: { 'default': { name: '默认预设' } },
    goals:     { 'default': { name: '默认预设' } },
    goals_ai_gen: { 'default': { name: '默认预设' } },
    storyline: { 'default': { name: '默认预设' } },
    backstage: { 'default': { name: '默认预设' } },
};

function getPresetSettings() {
    if (!extension_settings[MODULE_NAME]) extension_settings[MODULE_NAME] = {};
    const plot = extension_settings[MODULE_NAME];
    if (!plot.presets || typeof Object.values(plot.presets)[0] === 'string') {
        plot.presets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    }
    const cats = ['global','variables','goals','goals_ai_gen','storyline','backstage'];
    cats.forEach(cat => {
        if (!plot.presets[cat]) plot.presets[cat] = { 'default': { name: '默认预设' } };
    });
    if (!plot.currentPreset || typeof plot.currentPreset === 'string') {
        plot.currentPreset = { global: 'default', variables: 'default', goals: 'default', goals_ai_gen: 'default', storyline: 'default', backstage: 'default' };
    }
    cats.forEach(cat => {
        if (!plot.currentPreset[cat] || !plot.presets[cat][plot.currentPreset[cat]]) {
            plot.currentPreset[cat] = 'default';
        }
    });
    if (!plot.streamModules || typeof plot.streamModules !== 'object') {
        plot.streamModules = {
            variables: false,
            goals: false,
            storyline: false,
            backstage: true
        };
    }
    return plot;
}

function saveSettings() {
    getContext?.()?.saveSettingsDebounced?.();
}

// ── Full-screen editable modal ─────────────────────────────────────────────────

function showBlockEditModal(startBlock, moduleId) {
    let overlay = document.getElementById('plot-edit-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'plot-edit-modal-overlay';
        document.body.appendChild(overlay);
    }
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
        flex-direction: column;
        padding: 15px;
        box-sizing: border-box;
    `;
    overlay.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; height:100%; box-sizing:border-box; gap:10px;">
            <!-- Header Row 1: Title Input + Close Icon -->
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--SmartThemeBorderColor); padding-bottom:8px; flex-shrink:0; gap:10px;">
                <span style="font-size:0.8em; font-weight:bold; opacity:0.8; white-space:nowrap;">编辑块名称：</span>
                <input type="text" id="plot-edit-modal-name" class="plot-input" 
                    placeholder="请输入块名称..."
                    style="flex:1; font-weight:bold; font-size:0.9em; height:26px; padding:2px 8px; background:var(--SmartThemeInputBgColor); border:1px solid var(--SmartThemeBorderColor); border-radius:4px; color:var(--SmartThemeEmColor); outline:none;">
                <i id="plot-edit-modal-close" class="fa-solid fa-xmark" style="cursor:pointer; font-size:1.3em; color:var(--SmartThemeEmColor); padding:3px 6px;"></i>
            </div>
            <!-- Header Row 2: Navigation (Prev, Dropdown, Next) -->
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                <button id="plot-edit-modal-prev" class="menu_button plot-btn" style="padding:4px 10px; font-size:0.8em; white-space:nowrap;">
                    <i class="fa-solid fa-chevron-left"></i> 上一个
                </button>
                <select id="plot-edit-modal-select" class="plot-select" style="flex:1; height:26px; font-size:0.8em; padding:0 6px; border:1px solid var(--SmartThemeBorderColor); background:var(--SmartThemeInputBgColor); color:var(--SmartThemeBodyColor); cursor:pointer;">
                </select>
                <button id="plot-edit-modal-next" class="menu_button plot-btn" style="padding:4px 10px; font-size:0.8em; white-space:nowrap;">
                    下一个 <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
            <!-- Textarea Editor -->
            <textarea id="plot-edit-modal-ta" class="plot-input" spellcheck="false" autocomplete="off" autocapitalize="off"
                style="flex:1; width:100%; font-family:monospace; font-size:0.9em; line-height:1.5; background:var(--SmartThemeInputBgColor); color:var(--SmartThemeInputTextColor); border:1px solid var(--SmartThemeInputBorderColor); border-radius:4px; resize:none; padding:12px; box-sizing:border-box;"></textarea>
        </div>`;

    const nameInput = overlay.querySelector('#plot-edit-modal-name');
    const ta = overlay.querySelector('#plot-edit-modal-ta');
    const prevBtn = overlay.querySelector('#plot-edit-modal-prev');
    const nextBtn = overlay.querySelector('#plot-edit-modal-next');
    const selectEl = overlay.querySelector('#plot-edit-modal-select');

    const blocks = getLiveBlocks(moduleId);
    let currentBlock = startBlock;

    const saveCurrent = () => {
        if (!currentBlock) return;
        
        // Clone the block to bypass frozen object mutations
        const updatedBlock = {
            ...currentBlock,
            name: nameInput.value,
            content: ta.value,
            moduleId: moduleId // Force explicit moduleId
        };

        saveBlock(updatedBlock);
        saveSettings();

        // Update active array reference so changes persist during modal navigation
        const idx = blocks.findIndex(b => b.identifier === currentBlock.identifier);
        if (idx !== -1) {
            blocks[idx] = updatedBlock;
        }
        currentBlock = updatedBlock;
    };

    const loadBlockData = (block) => {
        currentBlock = block;
        nameInput.value = block.name;
        ta.value = block.content;

        const idx = blocks.findIndex(b => b.identifier === block.identifier);
        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx === -1 || idx >= blocks.length - 1;

        // Update select value
        selectEl.value = block.identifier;
    };

    // Populate dropdown options
    selectEl.innerHTML = blocks.map((b, i) => `
        <option value="${b.identifier}">${escapeHtml(b.name || '未命名')} (${ROLE_LABELS[b.role] || b.role})</option>
    `).join('');

    selectEl.addEventListener('change', (e) => {
        saveCurrent();
        const nextBlock = blocks.find(b => b.identifier === e.target.value);
        if (nextBlock) {
            loadBlockData(nextBlock);
        }
    });

    prevBtn.addEventListener('click', () => {
        const idx = blocks.findIndex(b => b.identifier === currentBlock.identifier);
        if (idx > 0) {
            saveCurrent();
            loadBlockData(blocks[idx - 1]);
        }
    });

    nextBtn.addEventListener('click', () => {
        const idx = blocks.findIndex(b => b.identifier === currentBlock.identifier);
        if (idx !== -1 && idx < blocks.length - 1) {
            saveCurrent();
            loadBlockData(blocks[idx + 1]);
        }
    });

    // Close listeners
    const doClose = () => {
        try {
            saveCurrent();
            activeRenderBlockList?.();
            toastr.success('全屏修改已保存');
        } catch (err) {
            console.error('Error auto-saving on full screen modal close:', err);
            toastr.error('全屏保存失败，请检查控制台');
        } finally {
            overlay.style.display = 'none';
        }
    };

    overlay.querySelector('#plot-edit-modal-close').onclick = doClose;
    overlay.onclick = e => { if (e.target === overlay) doClose(); };

    // Initial load
    loadBlockData(startBlock);
    overlay.style.display = 'flex';
}

// ── Block CRUD helpers ─────────────────────────────────────────────────────────

/** Return the current live block list for a module, merged from built-ins + user overrides */
function getLiveBlocks(moduleId) {
    return getBlocks(moduleId);
}

/** Get the next available order value for a module */
function nextOrder(moduleId) {
    const blocks = getLiveBlocks(moduleId);
    const max = blocks.reduce((m, b) => Math.max(m, b.order ?? 0), 0);
    return max + 10;
}

/** Create a new custom block for the given module */
function addCustomBlock(moduleId) {
    const s = extension_settings[MODULE_NAME];
    const presetId = s.currentPreset?.[moduleId] || 'default';
    const preset = s.presets?.[moduleId]?.[presetId];
    if (preset) {
        if (!preset.promptBlocks) preset.promptBlocks = {};
    }
    const id = `custom_${moduleId}_${Date.now()}`;
    const block = {
        identifier: id,
        name: '新提示词块',
        role: 'system',
        order: nextOrder(moduleId),
        enabled: true,
        builtin: false,
        moduleId,
        content: ''
    };
    saveBlock(block); // Saves block to the active preset'
    return block;
}

/** Duplicate / clone a prompt block */
function duplicateBlock(moduleId, sourceBlock) {
    const id = `custom_${moduleId}_${Date.now()}`;
    const newBlock = {
        identifier: id,
        name: `${sourceBlock.name} 副本`,
        role: sourceBlock.role,
        order: (sourceBlock.order ?? 0) + 1,
        enabled: sourceBlock.enabled ?? true,
        builtin: false,
        moduleId: sourceBlock.moduleId || moduleId,
        content: sourceBlock.content || ''
    };
    saveBlock(newBlock);
    
    // Normalize order sequences to 10, 20, 30...
    const liveBlocks = getLiveBlocks(moduleId);
    liveBlocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    liveBlocks.forEach((b, idx) => {
        b.order = (idx + 1) * 10;
        saveBlock(b, moduleId);
    });
    
    saveSettings();
}

// ── Role badge colours ─────────────────────────────────────────────────────────

const ROLE_COLORS = {
    system:    'rgba(80,120,220,0.25)',
    user:      'rgba(60,160,100,0.25)',
    assistant: 'rgba(160,100,60,0.25)',
};
const ROLE_LABELS = { system: 'System', user: 'User', assistant: 'AI' };

// ── Main export ────────────────────────────────────────────────────────────────

export async function renderPromptsTab(containerEl) {
    let currentModule = localStorage.getItem('plot_active_prompts_category_id') || 'variables';
    if (currentModule === 'global') currentModule = 'variables';
    const s = getPresetSettings();

    // ── Outer shell (module select + description + editor pane) ──────────────────
    const buildShell = async () => {
        const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/tab-prompts');
        containerEl.innerHTML = html;

        // Render module selector dropdown
        const moduleSelect = containerEl.querySelector('#pt-module-select');
        if (moduleSelect) {
            moduleSelect.innerHTML = MODULES.map(m => `
                <option value="${m.id}" ${m.id === currentModule ? 'selected' : ''}>${m.label}</option>
            `).join('');
            
            moduleSelect.addEventListener('change', () => {
                currentModule = moduleSelect.value;
                localStorage.setItem('plot_active_prompts_category_id', currentModule);
                renderAll();
            });
        }

        // Manual save button click handler
        containerEl.querySelector('#plot-prompts-save-btn').addEventListener('click', () => {
            saveSettings();
            alert('保存成功！');
        });

        // Cheat sheet toggle
        const cheatHdr  = containerEl.querySelector('#pt-cheat-hdr');
        const cheatBody = containerEl.querySelector('#pt-cheat-body');
        const cheatIcon = containerEl.querySelector('#pt-cheat-icon');
        cheatHdr.addEventListener('click', () => {
            const open = cheatBody.style.display !== 'none';
            cheatBody.style.display = open ? 'none' : 'flex';
            cheatIcon.className = open ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
        });

        // Order manager popup modal button listener
        const orderBtn = containerEl.querySelector('#pt-order-btn');
        if (orderBtn) {
            orderBtn.addEventListener('click', () => {
                showOrderModal(currentModule);
            });
        }

        renderAll();
    };

    // ── Render both preset bar and block list ──────────────────────────────────
    const renderAll = () => {
        const descEl = containerEl.querySelector('#pt-desc');
        const modInfo = MODULES.find(m => m.id === currentModule);
        if (descEl) descEl.textContent = modInfo?.desc || '';

        // Handle module config bar display and stream toggle
        const configBar = containerEl.querySelector('#pt-module-config-bar');
        if (configBar) {
            configBar.style.display = 'flex';
            const streamToggle = containerEl.querySelector('#pt-module-stream-toggle');
            if (streamToggle) {
                streamToggle.checked = s.streamModules?.[currentModule] !== false;
                // Clone to remove previous event listeners
                const newToggle = streamToggle.cloneNode(true);
                streamToggle.parentNode.replaceChild(newToggle, streamToggle);
                newToggle.addEventListener('change', () => {
                    if (!s.streamModules) s.streamModules = {};
                    s.streamModules[currentModule] = newToggle.checked;
                    saveSettings();
                });
            }
        }

        renderPresetBar();
        renderBlockList();
        renderCheatSheet();
    };

    // ── Preset bar ─────────────────────────────────────────────────────────────
    const renderPresetBar = () => {
        const bar = containerEl.querySelector('#pt-preset-bar');
        if (!bar) return;

        const catPresets = s.presets[currentModule];
        const curId = s.currentPreset[currentModule];
        const curPreset = catPresets[curId];
        const isDefault = curId === 'default';

        const opts = Object.entries(catPresets)
            .map(([id, p]) => `<option value="${id}" ${id === curId ? 'selected' : ''}>${p.name}</option>`)
            .join('');

        bar.innerHTML = `
            <span style="font-size:0.78em;font-weight:bold;white-space:nowrap;color:var(--SmartThemeEmColor);">预设</span>
            <select id="pt-sel" class="plot-select" style="flex:1;font-size:0.8em;height:24px;padding:0 4px;">${opts}</select>
            <div style="display:flex;gap:2px;margin-left:auto;flex-shrink:0;">
                <button id="pt-new"    class="menu_button plot-btn" style="padding:2px 5px;font-size:0.78em;" title="新建"><i class="fa-solid fa-plus"></i></button>
                <button id="pt-rename" class="menu_button plot-btn" style="padding:2px 5px;font-size:0.78em;" title="重命名" ${isDefault?'disabled':''}><i class="fa-solid fa-pen"></i></button>
                <button id="pt-del"    class="menu_button plot-btn" style="padding:2px 5px;font-size:0.78em;" title="删除"   ${isDefault?'disabled':''}><i class="fa-solid fa-trash"></i></button>
                <button id="pt-exp"    class="menu_button plot-btn" style="padding:2px 5px;font-size:0.78em;" title="导出"><i class="fa-solid fa-file-export"></i></button>
                <button id="pt-imp"    class="menu_button plot-btn" style="padding:2px 5px;font-size:0.78em;" title="导入"><i class="fa-solid fa-file-import"></i></button>
            </div>
            <input type="file" id="pt-imp-file" style="display:none;" accept=".json">
        `;

        bar.querySelector('#pt-sel').addEventListener('change', e => {
            s.currentPreset[currentModule] = e.target.value;
            saveSettings();
            renderPresetBar();
            renderBlockList(); // Refresh block list
        });
        bar.querySelector('#pt-new').addEventListener('click', () => {
            const name = prompt('新预设名称：', (curPreset?.name || '预设') + ' 副本');
            if (!name?.trim()) return;
            const id = 'preset_' + Date.now();
            
            // Duplicate the blocks of the current active preset into the new preset
            const sourceBlocks = curPreset?.promptBlocks ? JSON.parse(JSON.stringify(curPreset.promptBlocks)) : null;
            catPresets[id] = { 
                name: name.trim(),
                promptBlocks: sourceBlocks || {}
            };
            
            s.currentPreset[currentModule] = id;
            saveSettings(); 
            renderPresetBar();
            renderBlockList(); // Refresh block list
        });
        if (!isDefault) {
            bar.querySelector('#pt-rename').addEventListener('click', () => {
                const name = prompt('重命名为：', curPreset?.name || '');
                if (!name?.trim()) return;
                curPreset.name = name.trim();
                saveSettings(); renderPresetBar();
            });
            bar.querySelector('#pt-del').addEventListener('click', () => {
                if (!confirm(`删除预设【${curPreset?.name}】？`)) return;
                delete catPresets[curId];
                s.currentPreset[currentModule] = 'default';
                saveSettings(); 
                renderPresetBar();
                renderBlockList(); // Refresh block list
            });
        }
        bar.querySelector('#pt-exp').addEventListener('click', () => {
            const blocks = getLiveBlocks(currentModule);
            const data = { presetName: curPreset?.name || '导出预设', moduleId: currentModule, blocks };
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const a = Object.assign(document.createElement('a'), { href: url, download: `plot_${currentModule}.json` });
            a.click(); URL.revokeObjectURL(url);
        });
        const fileInput = bar.querySelector('#pt-imp-file');
        bar.querySelector('#pt-imp').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', e => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = evt => {
                try {
                    const data = JSON.parse(evt.target.result);
                    const ps = extension_settings[MODULE_NAME];
                    const presetId = ps.currentPreset?.[currentModule] || 'default';
                    const preset = ps.presets?.[currentModule]?.[presetId];
                    if (preset) {
                        if (!preset.promptBlocks) preset.promptBlocks = {};
                        if (Array.isArray(data.blocks)) {
                            data.blocks.forEach(b => {
                                if (b.identifier && !b.builtin) preset.promptBlocks[b.identifier] = b;
                            });
                            saveSettings(); renderBlockList();
                            alert('导入成功');
                        } else {
                            alert('格式错误：缺少 blocks 数组');
                        }
                    }
                } catch (err) { alert('导入失败：' + err.message); }
            };
            reader.readAsText(file);
        });
    };

    // ── Order manager (Modal popup drag-and-drop) ──────────────────────────────
    const showOrderModal = (moduleId) => {
        let overlay = document.getElementById('plot-order-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'plot-order-modal-overlay';
            document.body.appendChild(overlay);
        }
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
            flex-direction: column;
            padding: 15px;
            box-sizing: border-box;
        `;
        overlay.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; height:100%; box-sizing:border-box; gap:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--SmartThemeBorderColor); padding-bottom:8px; flex-shrink:0;">
                    <h3 style="margin:0; color:var(--SmartThemeEmColor); font-size:1.05em; font-weight:bold; display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-bars-staggered"></i> 顺序管理 (拖拽排序)
                    </h3>
                    <div style="display:flex; gap:6px;">
                        <button id="plot-order-modal-close-btn" class="menu_button plot-btn" style="padding:3px 10px; font-size:0.85em;">
                            <i class="fa-solid fa-check"></i> 完成
                        </button>
                        <i id="plot-order-modal-close-icon" class="fa-solid fa-xmark" style="cursor:pointer; font-size:1.3em; color:var(--SmartThemeEmColor); padding:3px 6px;"></i>
                    </div>
                </div>
                <p style="margin:0; font-size:0.75em; opacity:0.7; flex-shrink:0;">按住 <i class="fa-solid fa-grip-vertical"></i> 拖拽下列项可直接调整提示词的注入顺序：</p>
                <div id="plot-order-modal-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:6px; padding-right:4px;"></div>
            </div>
        `;

        const listContainer = overlay.querySelector('#plot-order-modal-list');
        const blocks = getLiveBlocks(moduleId);

        const renderModalItems = () => {
            listContainer.innerHTML = '';
            blocks.forEach((block) => {
                const item = document.createElement('div');
                item.className = 'pt-order-item';
                item.dataset.id = block.identifier;
                item.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    background: var(--SmartThemeInputBgColor);
                    color: var(--SmartThemeBodyColor);
                    border: 1px solid var(--SmartThemeBorderColor);
                    border-radius: 4px;
                    cursor: grab;
                    user-select: none;
                    font-size: 0.82em;
                    transition: opacity 0.2s, background-color 0.2s;
                    touch-action: none;
                `;

                const roleBg = ROLE_COLORS[block.role] || 'rgba(120,120,120,0.15)';
                const roleLabel = ROLE_LABELS[block.role] || block.role;

                item.innerHTML = `
                    <i class="fa-solid fa-grip-vertical" style="color: var(--SmartThemeBodyColor); opacity: 0.5; cursor: grab;"></i>
                    <span style="font-weight: bold; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(block.name)}</span>
                    <span style="font-size: 0.75em; background: ${roleBg}; padding: 1px 4px; border-radius: 3px; font-weight: bold; white-space: nowrap;">${roleLabel}</span>
                `;

                // Unified Pointer Event listeners for both Mobile Touch and Desktop Mouse
                item.addEventListener('pointerdown', (e) => {
                    // Only left click/touch
                    if (e.button !== 0 && e.pointerType === 'mouse') return;

                    item.classList.add('dragging');
                    item.style.opacity = '0.6';
                    item.style.border = '1px dashed var(--SmartThemeEmColor)';

                    try {
                        item.setPointerCapture(e.pointerId);
                    } catch (err) {}
                    e.stopPropagation();
                });

                item.addEventListener('pointermove', (e) => {
                    if (!item.classList.contains('dragging')) return;
                    e.stopPropagation();

                    const clientY = e.clientY;
                    const siblings = [...listContainer.querySelectorAll('.pt-order-item:not(.dragging):not(#plot-drag-line)')];
                    const nextSibling = siblings.find(sibling => {
                        const box = sibling.getBoundingClientRect();
                        return clientY <= box.top + box.height / 2;
                    });

                    let dragLine = listContainer.querySelector('#plot-drag-line');
                    if (!dragLine) {
                        dragLine = document.createElement('div');
                        dragLine.id = 'plot-drag-line';
                        dragLine.style.cssText = 'height: 4px; background: var(--SmartThemeEmColor); border-radius: 2px; margin: 4px 0; transition: all 0.1s;';
                    }

                    if (nextSibling) {
                        listContainer.insertBefore(dragLine, nextSibling);
                    } else {
                        listContainer.appendChild(dragLine);
                    }
                });

                const onPointerUp = (e) => {
                    if (!item.classList.contains('dragging')) return;
                    item.classList.remove('dragging');
                    item.style.opacity = '1';
                    item.style.border = '1px solid var(--SmartThemeBorderColor)';

                    try {
                        item.releasePointerCapture(e.pointerId);
                    } catch (err) {}

                    const dragLine = listContainer.querySelector('#plot-drag-line');
                    if (dragLine) {
                        listContainer.insertBefore(item, dragLine);
                        dragLine.remove();
                    }

                    // Save new sequence when drag ends
                    const reorderedIds = [...listContainer.querySelectorAll('.pt-order-item')].map(el => el.dataset.id);
                    const blockMap = {};
                    blocks.forEach(b => { blockMap[b.identifier] = b; });

                    reorderedIds.forEach((id, newIndex) => {
                        const b = blockMap[id];
                        if (b) {
                            b.order = (newIndex + 1) * 10;
                            saveBlock(b, moduleId);
                        }
                    });

                    saveSettings();
                    renderBlockList();
                };

                item.addEventListener('pointerup', onPointerUp);
                item.addEventListener('pointercancel', onPointerUp);

                listContainer.appendChild(item);
            });
        };

        renderModalItems();

        const closeModal = () => {
            overlay.style.display = 'none';
        };

        overlay.querySelector('#plot-order-modal-close-btn').addEventListener('click', closeModal);
        overlay.querySelector('#plot-order-modal-close-icon').addEventListener('click', closeModal);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

        overlay.style.display = 'flex';
    };

    // ── Block list ─────────────────────────────────────────────────────────────
    const renderBlockList = () => {
        activeRenderBlockList = renderBlockList;
        const list = containerEl.querySelector('#pt-block-list');
        if (!list) return;

        const blocks = getLiveBlocks(currentModule);
        list.innerHTML = '';

        blocks.forEach((block, idx) => {
            const card = document.createElement('div');
            card.dataset.id = block.identifier;
            card.style.cssText = `border:1px solid var(--SmartThemeBorderColor);border-radius:6px;overflow:hidden;`;

            const roleBg = ROLE_COLORS[block.role] || 'rgba(120,120,120,0.15)';
            const roleLabel = ROLE_LABELS[block.role] || block.role;
            const isFirst = idx === 0;
            const isLast = idx === blocks.length - 1;

            card.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding:6px 8px; background:rgba(0,0,0,0.03); flex-wrap:nowrap; width:100%; box-sizing:border-box;">
                    <!-- Left: Toggle + Role + Name + Badges -->
                    <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
                        <!-- Enable toggle -->
                        <label class="plot-switch" style="flex-shrink:0; transform: scale(0.8); margin: 0;">
                            <input type="checkbox" class="blk-toggle" ${block.enabled ? 'checked' : ''}>
                            <span class="plot-switch-slider"></span>
                        </label>
                        
                        <!-- Role selector (narrowed down) -->
                        <select class="blk-role"
                            style="font-size:0.72em; height:22px; width:44px !important; min-width:44px !important; max-width:44px !important; padding:0 !important; text-align-last:center; background:${roleBg}; border-radius:3px; flex-shrink:0; border:1px solid var(--SmartThemeBorderColor); color:var(--SmartThemeBodyColor); cursor:pointer; -webkit-appearance:none; -moz-appearance:none; appearance:none;">
                            <option value="system"    ${block.role==='system'    ? 'selected':''}>Sys</option>
                            <option value="user"      ${block.role==='user'      ? 'selected':''}>Usr</option>
                            <option value="assistant" ${block.role==='assistant' ? 'selected':''}>AI</option>
                        </select>
                        
                        <!-- Name field — always editable -->
                        <input type="text" class="blk-name"
                            value="${block.name.replace(/"/g,'&quot;')}"
                            placeholder="请输入块名称..."
                            onfocus="this.style.borderBottomColor='var(--SmartThemeEmColor)'"
                            onblur="this.style.borderBottomColor='transparent'"
                            style="width:90px !important; min-width:90px !important; max-width:90px !important; flex:none; font-size:0.82em; font-weight:bold; color:var(--SmartThemeEmColor); background:transparent; border:none; border-bottom:1px solid transparent; outline:none; padding:1px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            
                        <!-- Badges -->
                        <div style="display:flex; gap:2px; flex-shrink:0; align-items:center;">
                            ${block.moduleId === 'global'
                                ? '<span style="font-size:0.65em; color:var(--SmartThemeQuoteColor); background:rgba(255,165,0,0.12); padding:1px 4px; border-radius:3px; font-weight:bold; white-space:nowrap;">全局</span>'
                                : ''}
                            ${block.builtin
                                ? '<span style="font-size:0.65em; color:var(--SmartThemeBodyColor); background:rgba(128,128,128,0.12); padding:1px 4px; border-radius:3px; font-weight:bold; white-space:nowrap;">内置</span>'
                                : ''}
                        </div>
                    </div>
                    
                    <!-- Right: Action buttons -->
                    <div style="display:flex; gap:3px; flex-shrink:0; align-items:center; white-space:nowrap;">
                        <button class="menu_button plot-btn blk-copy"       style="padding:2px 6px; font-size:0.75em;" title="复制内容"><i class="fa-solid fa-copy"></i></button>
                        <button class="menu_button plot-btn blk-fullscreen" style="padding:2px 6px; font-size:0.75em;" title="全屏编辑"><i class="fa-solid fa-expand"></i></button>
                        <button class="menu_button plot-btn blk-expand"     style="padding:2px 6px; font-size:0.75em;" title="展开/折叠内容"><i class="fa-solid fa-chevron-down"></i></button>
                        ${block.builtin
                            ? `<button class="menu_button plot-btn blk-reset"  style="padding:2px 6px; font-size:0.75em;" title="重置为内置默认"><i class="fa-solid fa-arrow-rotate-left"></i></button>`
                            : ''}
                        <button class="menu_button plot-btn blk-delete" style="padding:2px 6px; font-size:0.75em; color:var(--SmartThemeQuoteColor);" title="删除此块"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <!-- Expandable content editor -->
                <div class="blk-body" style="display:none; padding:8px;">
                    <textarea class="plot-input blk-ta" rows="5"
                        style="width:100%; font-family:monospace; font-size:0.82em; background:var(--SmartThemeInputBgColor); color:var(--SmartThemeInputTextColor); border:1px solid var(--SmartThemeInputBorderColor); padding:8px; border-radius:4px; box-sizing:border-box; resize:vertical;" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
                </div>
            `;

            list.appendChild(card);

            // Populate content programmatically to prevent HTML injection/parsing bugs
            const ta = card.querySelector('.blk-ta');
            ta.value = block.content;

            // Bind events
            const toggle = card.querySelector('.blk-toggle');
            toggle.addEventListener('change', () => {
                const updatedBlock = { ...block, enabled: toggle.checked };
                saveBlock(updatedBlock);
                saveSettings();
                block = updatedBlock;
            });

            const roleSel = card.querySelector('.blk-role');
            roleSel.addEventListener('change', () => {
                const updatedBlock = { ...block, role: roleSel.value };
                roleSel.style.background = ROLE_COLORS[updatedBlock.role] || 'rgba(120,120,120,0.15)';
                saveBlock(updatedBlock);
                saveSettings();
                block = updatedBlock;
            });

            // Name — editable for all blocks
            const nameInput = card.querySelector('.blk-name');
            nameInput.addEventListener('change', () => {
                const updatedBlock = { ...block, name: nameInput.value };
                saveBlock(updatedBlock);
                saveSettings();
                block = updatedBlock;
            });

            // Expand/collapse
            const expandBtn = card.querySelector('.blk-expand');
            const body = card.querySelector('.blk-body');
            expandBtn.addEventListener('click', () => {
                const open = body.style.display !== 'none';
                body.style.display = open ? 'none' : 'block';
                expandBtn.querySelector('i').className = open ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
            });

            // Content editing
            ta.addEventListener('input', () => {
                const updatedBlock = { ...block, content: ta.value };
                clearTimeout(ta._st);
                ta._st = setTimeout(() => {
                    saveBlock(updatedBlock);
                    saveSettings();
                }, 600);
                block = updatedBlock;
            });

            ta.addEventListener('focus', () => {
                lastFocusedTextarea = ta;
            });

            // Copy content
            const copyBtn = card.querySelector('.blk-copy');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    duplicateBlock(currentModule, block);
                    renderBlockList();
                    toastr.success(`已克隆并生成提示词块「${block.name} 副本」`);
                });
            }

            // Fullscreen edit
            card.querySelector('.blk-fullscreen').addEventListener('click', () => {
                showBlockEditModal(block, currentModule);
            });

            // Reset (built-in only) — removes override, restores default content
            const resetBtn = card.querySelector('.blk-reset');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    if (!confirm(`重置「${block.name}」为内置默认？这将清除所有修改。`)) return;
                    resetBlock(block.identifier, block.moduleId);
                    renderBlockList();
                });
            }

            // Delete — for built-ins: mark deleted:true in override; for custom: remove entirely
            const delBtn = card.querySelector('.blk-delete');
            if (delBtn) {
                delBtn.addEventListener('click', () => {
                    if (!confirm(`删除「${block.name}」？${block.builtin ? '（内置块将被隐藏，可通过重置恢复）' : ''}`)) return;
                    deleteBlock(block.identifier, block.moduleId || currentModule);
                    renderBlockList();
                });
            }
        });

        // ── Add block button ──
        const addBtn = document.createElement('button');
        addBtn.className = 'menu_button plot-btn';
        addBtn.style.cssText = 'width:100%;padding:5px;font-size:0.83em;margin-top:4px;border:1px dashed var(--SmartThemeBorderColor);border-radius:6px;background:transparent;';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> 添加提示词块';
        addBtn.addEventListener('click', () => {
            addCustomBlock(currentModule);
            renderBlockList();
            // Auto-scroll to bottom
            containerEl.scrollTop = containerEl.scrollHeight;
        });
        list.appendChild(addBtn);
    };

    // ── Cheat sheet ────────────────────────────────────────────────────────────
    const renderCheatSheet = () => {
        const body = containerEl.querySelector('#pt-cheat-body');
        if (!body) return;
        const items = PLACEHOLDERS[currentModule] || PLACEHOLDERS.global;
        body.innerHTML = items.map(item => `
            <div style="display:flex;gap:10px;align-items:flex-start;">
                <code class="plot-cheat-code" data-key="${item.key}" style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:3px;color:var(--SmartThemeEmColor);font-family:monospace;white-space:nowrap;cursor:pointer;" title="点击可直接插入到最后获取焦点的输入框">${item.key}</code>
                <span style="color:var(--SmartThemeBodyColor);">${item.desc}</span>
            </div>`).join('');

        body.querySelectorAll('.plot-cheat-code').forEach(el => {
            el.addEventListener('click', () => {
                const key = el.getAttribute('data-key');
                if (lastFocusedTextarea) {
                    const start = lastFocusedTextarea.selectionStart;
                    const end = lastFocusedTextarea.selectionEnd;
                    const text = lastFocusedTextarea.value;
                    const before = text.substring(0, start);
                    const after = text.substring(end, text.length);
                    lastFocusedTextarea.value = before + key + after;
                    lastFocusedTextarea.selectionStart = lastFocusedTextarea.selectionEnd = start + key.length;
                    lastFocusedTextarea.focus();
                    
                    // Trigger input event to save block content
                    lastFocusedTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    toastr.warning('请先点击聚焦上方任意一个输入框，然后再点击此占位符进行插入。');
                }
            });
        });
    };

    await buildShell();
}
