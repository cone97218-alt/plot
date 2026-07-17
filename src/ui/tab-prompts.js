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

const MODULES = [
    { id: 'variables', label: '变量判定',   desc: '变量判定模块的提示词配置' },
    { id: 'goals',     label: '目标判定',   desc: '目标达成判定模块的提示词配置' },
    { id: 'goals_ai_gen', label: '目标生成', desc: '目标智能自动生成模块的提示词配置' },
    { id: 'storyline', label: '故事线判定', desc: '故事线进度分析模块的提示词配置' },
    { id: 'backstage', label: '幕后生成',   desc: '幕后交互与生成模块的提示词配置' },
];

const PLACEHOLDERS = {
    variables:  [
        { key: '{{variables_list}}', desc: '当前所有已注册变量键值列表' },
        { key: '{{chat_history}}',   desc: '对话历史' },
    ],
    goals:      [
        { key: '{{goals_list}}',   desc: '当前未完成目标列表' },
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
        { key: '{{storyline_status}}', desc: '当前激活故事线阶段信息' },
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
    getContext().saveSettingsDebounced?.();
}

// ── Full-screen editable modal ─────────────────────────────────────────────────

function showEditModal(title, initialText, onSave) {
    let overlay = document.getElementById('plot-edit-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'plot-edit-modal-overlay';
        document.body.appendChild(overlay);
    }
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background-color:rgba(var(--SmartThemeBlurTintColor-rgb),1);color:var(--SmartThemeBodyColor);z-index:999999;display:flex;flex-direction:column;padding:15px;box-sizing:border-box;`;
    overlay.innerHTML = `
        <div style="flex:1;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--SmartThemeBorderColor);padding-bottom:8px;flex-shrink:0;">
                <h3 style="margin:0;color:var(--SmartThemeEmColor);font-size:1em;font-weight:bold;">${title}</h3>
                <div style="display:flex;gap:6px;">
                    <button id="plot-edit-modal-save" class="menu_button plot-btn" style="padding:3px 10px;font-size:0.85em;"><i class="fa-solid fa-check"></i> 保存</button>
                    <i id="plot-edit-modal-close" class="fa-solid fa-xmark" style="cursor:pointer;font-size:1.3em;color:var(--SmartThemeEmColor);padding:3px 6px;"></i>
                </div>
            </div>
            <textarea id="plot-edit-modal-ta" class="plot-input"
                style="flex:1;width:100%;font-family:monospace;font-size:0.92em;line-height:1.5;background:var(--SmartThemeInputBgColor);color:var(--SmartThemeInputTextColor);border:1px solid var(--SmartThemeInputBorderColor);border-radius:4px;resize:none;padding:12px;box-sizing:border-box;">${initialText}</textarea>
        </div>`;
    overlay.querySelector('#plot-edit-modal-save').addEventListener('click', () => {
        const val = overlay.querySelector('#plot-edit-modal-ta').value;
        onSave(val);
        overlay.style.display = 'none';
    });
    overlay.querySelector('#plot-edit-modal-close').addEventListener('click', () => {
        overlay.style.display = 'none';
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
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

/** Move a block up (lower order) or down (higher order) relative to its neighbours */
function moveBlock(moduleId, identifier, direction) {
    const blocks = getLiveBlocks(moduleId);
    const idx = blocks.findIndex(b => b.identifier === identifier);
    if (idx === -1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= blocks.length) return;

    const a = blocks[idx];
    const b = blocks[swapIdx];
    const tempOrder = a.order;
    a.order = b.order;
    b.order = tempOrder;

    // Ensure orders are at least 1 apart; if equal, adjust
    if (a.order === b.order) {
        if (direction === 'up') a.order = b.order - 1;
        else a.order = b.order + 1;
    }

    saveBlock(a);
    saveBlock(b);
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

    // ── Block list ─────────────────────────────────────────────────────────────
    const renderBlockList = () => {
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
                <!-- Two-row Responsive Header -->
                <div style="display:flex; flex-direction:column; gap:6px; padding:6px 8px; background:rgba(0,0,0,0.03);">
                    <!-- Row 1: Toggle + Name + Badges -->
                    <div style="display:flex; align-items:center; gap:8px; width:100%;">
                        <!-- Enable toggle -->
                        <label class="plot-switch" style="flex-shrink:0;">
                            <input type="checkbox" class="blk-toggle" ${block.enabled ? 'checked' : ''}>
                            <span class="plot-switch-slider"></span>
                        </label>
                        <!-- Name field — always editable -->
                        <input type="text" class="blk-name"
                            value="${block.name.replace(/"/g,'&quot;')}"
                            placeholder="请输入块名称..."
                            onfocus="this.style.borderBottomColor='var(--SmartThemeEmColor)'"
                            onblur="this.style.borderBottomColor='transparent'"
                            style="flex:1; min-width:0; font-size:0.85em; font-weight:bold; color:var(--SmartThemeEmColor); background:transparent; border:none; border-bottom:1px solid transparent; outline:none; padding:1px 0;">
                        <!-- Badges -->
                        <div style="display:flex; gap:4px; flex-shrink:0; align-items:center;">
                            ${block.moduleId === 'global'
                                ? '<span style="font-size:0.68em; color:var(--SmartThemeQuoteColor); background:rgba(255,165,0,0.15); padding:1px 5px; border-radius:3px; font-weight:bold; white-space:nowrap;">全局</span>'
                                : ''}
                            ${block.builtin
                                ? '<span style="font-size:0.68em; color:var(--SmartThemeBodyColor); background:rgba(128,128,128,0.15); padding:1px 5px; border-radius:3px; font-weight:bold; white-space:nowrap;">内置</span>'
                                : ''}
                        </div>
                    </div>
                    <!-- Row 2: Role Selector + Action Buttons -->
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; border-top:1px solid rgba(255,255,255,0.05); padding-top:5px;">
                        <!-- Role selector -->
                        <select class="blk-role plot-select"
                            style="font-size:0.75em; height:22px; padding:0 4px; background:${roleBg}; border-radius:3px; flex-shrink:0; border:1px solid var(--SmartThemeBorderColor); color:var(--SmartThemeBodyColor); cursor:pointer;">
                            <option value="system"    ${block.role==='system'    ? 'selected':''}>System</option>
                            <option value="user"      ${block.role==='user'      ? 'selected':''}>User</option>
                            <option value="assistant" ${block.role==='assistant' ? 'selected':''}>AI</option>
                        </select>
                        <!-- Action buttons -->
                        <div style="display:flex; gap:3px; flex-shrink:0; align-items:center; white-space:nowrap;">
                            <button class="menu_button plot-btn blk-up"         style="padding:2px 6px; font-size:0.75em;" title="上移"   ${isFirst ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                            <button class="menu_button plot-btn blk-down"       style="padding:2px 6px; font-size:0.75em;" title="下移"   ${isLast  ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                            <button class="menu_button plot-btn blk-fullscreen" style="padding:2px 6px; font-size:0.75em;" title="全屏编辑"><i class="fa-solid fa-expand"></i></button>
                            <button class="menu_button plot-btn blk-expand"     style="padding:2px 6px; font-size:0.75em;" title="展开/折叠内容"><i class="fa-solid fa-chevron-down"></i></button>
                            ${block.builtin
                                ? `<button class="menu_button plot-btn blk-reset"  style="padding:2px 6px; font-size:0.75em;" title="重置为内置默认"><i class="fa-solid fa-arrow-rotate-left"></i></button>`
                                : ''}
                            <button class="menu_button plot-btn blk-delete" style="padding:2px 6px; font-size:0.75em; color:var(--SmartThemeQuoteColor);" title="删除此块"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
                <!-- Expandable content editor -->
                <div class="blk-body" style="display:none; padding:8px;">
                    <textarea class="plot-input blk-ta" rows="5"
                        style="width:100%; font-family:monospace; font-size:0.82em; background:var(--SmartThemeInputBgColor); color:var(--SmartThemeInputTextColor); border:1px solid var(--SmartThemeInputBorderColor); padding:8px; border-radius:4px; box-sizing:border-box; resize:vertical;"></textarea>
                </div>
            `;

            list.appendChild(card);

            // Populate content programmatically to prevent HTML injection/parsing bugs
            const ta = card.querySelector('.blk-ta');
            ta.value = block.content;

            // Bind events
            const toggle = card.querySelector('.blk-toggle');
            toggle.addEventListener('change', () => {
                block.enabled = toggle.checked;
                saveBlock(block, currentModule);
            });

            const roleSel = card.querySelector('.blk-role');
            roleSel.addEventListener('change', () => {
                block.role = roleSel.value;
                roleSel.style.background = ROLE_COLORS[block.role] || 'rgba(120,120,120,0.15)';
                saveBlock(block, currentModule);
            });

            // Name — editable for all blocks
            const nameInput = card.querySelector('.blk-name');
            nameInput.addEventListener('change', () => {
                block.name = nameInput.value;
                saveBlock(block, currentModule);
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
                block.content = ta.value;
                clearTimeout(ta._st);
                ta._st = setTimeout(() => saveBlock(block, currentModule), 600);
            });

            ta.addEventListener('focus', () => {
                lastFocusedTextarea = ta;
            });

            // Fullscreen edit
            card.querySelector('.blk-fullscreen').addEventListener('click', () => {
                showEditModal(`全屏编辑：${block.name}`, block.content, val => {
                    block.content = val;
                    ta.value = val;
                    saveBlock(block, currentModule);
                });
            });

            // Move up/down
            const upBtn = card.querySelector('.blk-up');
            const dnBtn = card.querySelector('.blk-down');
            if (upBtn && !isFirst) {
                upBtn.addEventListener('click', () => { moveBlock(currentModule, block.identifier, 'up'); renderBlockList(); });
            }
            if (dnBtn && !isLast) {
                dnBtn.addEventListener('click', () => { moveBlock(currentModule, block.identifier, 'down'); renderBlockList(); });
            }

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
