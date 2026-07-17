/**
 * tab-goals.js - Goal/Quest System UI
 * Renders hierarchical goal tree, handles filters, quick additions, 
 * side configuration drawer with condition setups and cascading trigger actions.
 */

import { getContext, renderExtensionTemplateAsync } from '../../../../../extensions.js';
import { get, set, subscribe } from '../core/store.js';
import { listGoals, createGoal, deleteGoal, setGoalStatus, runActions } from '../core/goal-engine.js';
import { savePlotData } from '../core/storage.js';
import { createModuleConfigDrawer, getModuleModes, getActiveModeId, setActiveModeId, getActiveModeConfig } from './module-config-drawer.js';
import { callAI } from '../core/api-client.js';
import { buildContext } from '../core/context-reader.js';
import { getBlockContent, getBlocks, assemblePrompt } from '../core/prompt-builder.js';

let rootEl = null;
let activeFilter = 'active'; // 'active' | 'complete' | 'failed' | 'all'
let actionRowCompilers = []; // tracks functions to parse action configs in drawer
let isSelfUpdatingGoalStatus = false; // flag to optimize checkbox toggles and prevent full tree rebuilds

// B2/B14 Fix: module-level registration flags so that document-level and store
// listeners are only attached once, preventing accumulation across tab re-renders.
let _goalsEventsBound = false;
let _goalsStoreUnsubscribe = null;

// Helper to escape HTML safely
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export async function renderGoalsTab(containerEl) {
    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/tab-goals');
    containerEl.innerHTML = html;
    
    rootEl = containerEl;
    
    // ── 1. Bind Sub Tab Filters ──
    const filterBtns = rootEl.querySelectorAll('#plot-goals-filter-bar .plot-sub-tab');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            renderGoalTreeUI();
        });
    });
    
    // ── 2. Bind Manual Add Button ──
    const addTriggerBtn = rootEl.querySelector('#plot-goal-add-trigger-btn');
    addTriggerBtn.addEventListener('click', () => {
        openConfigDrawer(null); // opens drawer in create mode
    });
    
    // ── 3. Bind Drawer Cancel & Close ──
    const configDrawer = rootEl.querySelector('#plot-goal-config-drawer');
    const drawerClose = rootEl.querySelector('#plot-goal-drawer-close');
    const configCancel = rootEl.querySelector('#plot-goal-config-cancel');
    const configSave = rootEl.querySelector('#plot-goal-config-save');
    const typeSelect = rootEl.querySelector('#plot-drawer-goal-type');
    const addActionBtn = rootEl.querySelector('#plot-drawer-add-action-btn');
    
    const hideDrawer = () => {
        configDrawer.classList.remove('show');
        setTimeout(() => { configDrawer.style.display = 'none'; }, 200);
    };
    
    drawerClose.addEventListener('click', hideDrawer);
    configCancel.addEventListener('click', hideDrawer);
    
    // Toggle conditions view based on type selection
    typeSelect.addEventListener('change', () => {
        const type = typeSelect.value;
        rootEl.querySelector('#plot-drawer-cond-variable-group').style.display = type === 'variable' ? 'flex' : 'none';
        rootEl.querySelector('#plot-drawer-cond-keyword-group').style.display = type === 'keyword' ? 'flex' : 'none';
    });
    
    // Add Action row button click
    addActionBtn.addEventListener('click', () => {
        const actionListContainer = rootEl.querySelector('#plot-drawer-action-list');
        const goalId = rootEl.querySelector('#plot-drawer-goal-id').value;
        const rowObj = createActionRowDOM({}, goalId);
        actionListContainer.appendChild(rowObj.dom);
        actionRowCompilers.push(rowObj.getActionConfig);
    });
    
    // Add Custom Field button click
    const addCustomFieldBtn = rootEl.querySelector('#plot-drawer-add-custom-field-btn');
    if (addCustomFieldBtn) {
        addCustomFieldBtn.addEventListener('click', () => {
            const listContainer = rootEl.querySelector('#plot-drawer-custom-fields-list');
            if (listContainer) {
                const row = document.createElement('div');
                row.className = 'plot-custom-field-row';
                row.style.cssText = 'display: flex; gap: 6px; align-items: center; width: 100%;';
                row.innerHTML = `
                    <input type="text" class="plot-input field-key" placeholder="属性名(如 reward)" value="" style="flex: 1; font-size: 0.85em; padding: 4px 6px;">
                    <input type="text" class="plot-input field-val" placeholder="属性值" value="" style="flex: 2; font-size: 0.85em; padding: 4px 6px;">
                    <i class="fa-solid fa-trash-can field-delete" style="cursor: pointer; color: var(--SmartThemeQuoteColor); font-size: 0.9em; padding: 0 4px;" title="删除属性"></i>
                `;
                row.querySelector('.field-delete').addEventListener('click', () => row.remove());
                listContainer.appendChild(row);
            }
        });
    }
    

    
    // Save drawer configuration
    configSave.addEventListener('click', async () => {
        const id = rootEl.querySelector('#plot-drawer-goal-id').value;
        const title = rootEl.querySelector('#plot-drawer-goal-title').value.trim();
        const description = rootEl.querySelector('#plot-drawer-goal-desc').value.trim();
        const parentId = rootEl.querySelector('#plot-drawer-goal-parent').value || null;
        const type = typeSelect.value;
        const newStatus = rootEl.querySelector('#plot-drawer-goal-status').value;
        
        if (!title) {
            alert('任务名称不能为空');
            return;
        }
        
        const goals = { ...(get('goals') || {}) };
        let goal = goals[id];
        if (!goal) {
            goal = { id, status: 'active', type: 'manual', conditions: { variable: '', variableFail: '', keywords: [], keywordsFail: [] }, actions: [] };
            goals[id] = goal;
        }
        
        // Save manual status transition
        if (newStatus !== goal.status) {
            goal.status = newStatus;
            if (newStatus === 'active') {
                goal.completedDetail = '';
            } else {
                const labelMap = { complete: '已完成', failed: '已失败', hidden: '已隐藏' };
                goal.completedDetail = `手动在任务详情面板中更改状态为：${labelMap[newStatus] || newStatus}`;
            }
        }
        
        // Compile conditions
        const conditions = { variable: '', variableFail: '', keywords: [], keywordsFail: [] };
        if (type === 'variable') {
            conditions.variable = rootEl.querySelector('#plot-drawer-cond-variable-expr').value.trim();
            conditions.variableFail = rootEl.querySelector('#plot-drawer-cond-variable-expr-fail').value.trim();
        } else if (type === 'keyword') {
            const kwStr = rootEl.querySelector('#plot-drawer-cond-keywords').value;
            conditions.keywords = kwStr.split(',').map(k => k.trim()).filter(Boolean);
            const kwFailStr = rootEl.querySelector('#plot-drawer-cond-keywords-fail').value;
            conditions.keywordsFail = kwFailStr.split(',').map(k => k.trim()).filter(Boolean);
        }
        
        // Compile actions
        const actions = actionRowCompilers.map(fn => fn());
        
        // Apply edits
        goal.title = title;
        goal.description = description;
        goal.parentId = parentId;
        goal.type = type;
        goal.conditions = conditions;
        goal.actions = actions;
        
        // Compile custom/extra fields
        const extraFields = {};
        rootEl.querySelectorAll('#plot-drawer-custom-fields-list .plot-custom-field-row').forEach(row => {
            const key = row.querySelector('.field-key').value.trim();
            const val = row.querySelector('.field-val').value.trim();
            if (key && val) {
                extraFields[key] = val;
            }
        });
        
        // Delete previous extra keys on edit
        const oldExtraKeys = Object.keys(goal).filter(k => !['id', 'parentId', 'title', 'description', 'status', 'type', 'conditions', 'actions'].includes(k));
        oldExtraKeys.forEach(k => delete goal[k]);
        
        // Merge extraFields
        Object.assign(goal, extraFields);
        
        set('goals', goals);
        await savePlotData();
        
        hideDrawer();
        renderGoalTreeUI();
        
        // Update ST configurations
        getContext().saveSettingsDebounced?.();
        
        // Send a custom store update notify
        document.dispatchEvent(new CustomEvent('plot:storeUpdated', { 
            detail: { changed: { source: 'goal_config_saved', goalId: id } } 
        }));
    });
    
    // ── 4. Subscribe to Store updates ──
    // B2 Fix: only register these listeners once, regardless of how many times this
    // render function is called (e.g. after hot-reload / panel re-open).
    if (!_goalsEventsBound) {
        _goalsEventsBound = true;

        document.addEventListener('plot:storeUpdated', () => {
            if (isSelfUpdatingGoalStatus) return;
            if (document.getElementById('plot-goals-tree-container')) {
                renderGoalTreeUI();
            }
        });
    }

    // B14 Fix: cancel any previous store subscription before registering a new one
    if (_goalsStoreUnsubscribe) _goalsStoreUnsubscribe();
    _goalsStoreUnsubscribe = subscribe('goals', () => {
        if (isSelfUpdatingGoalStatus) return;
        if (document.getElementById('plot-goals-tree-container')) {
            renderGoalTreeUI();
        }
    });
    
    // ── 5. Bind Module Config Settings Drawer & Mode Dropdown ──
    const modeSelect = rootEl.querySelector('#plot-goals-mode-select');
    const refreshModeSelector = async () => {
        if (!modeSelect) return;
        const modes = getModuleModes('goals');
        const activeId = await getActiveModeId('goals');
        modeSelect.innerHTML = modes.map(m => `
            <option value="${m.id}" ${m.id === activeId ? 'selected' : ''}>${escapeHtml(m.name)}</option>
        `).join('');
    };
    
    modeSelect.addEventListener('change', async () => {
        await setActiveModeId('goals', modeSelect.value);
        getContext().saveSettingsDebounced?.();
        renderGoalTreeUI();
    });

    const configDrawerBtn = rootEl.querySelector('#plot-goals-settings-btn');
    const { show: showConfigDrawer } = createModuleConfigDrawer('goals', rootEl, async (newCfg) => {
        console.log('[Plot Goals] Config saved:', newCfg);
        await refreshModeSelector();
        renderGoalTreeUI();
    });
    configDrawerBtn.addEventListener('click', showConfigDrawer);
    
    // ── 6. Bind AI Goal Generator ──
    const aiGenBtn = rootEl.querySelector('#plot-goal-ai-gen-btn');
    const loadingOverlay = rootEl.querySelector('#plot-goals-loading-overlay');
    const clearAllBtn = rootEl.querySelector('#plot-goal-clear-all-btn');
    
    // AI Preview Modal elements
    const previewModal = rootEl.querySelector('#plot-goal-ai-preview-modal');
    const previewList = rootEl.querySelector('#plot-ai-preview-list');
    const previewClose = rootEl.querySelector('#plot-ai-preview-close');
    const previewRegen = rootEl.querySelector('#plot-ai-preview-regen');
    const previewAppend = rootEl.querySelector('#plot-ai-preview-append');
    
    let tempGeneratedGoals = [];
    let lastGuidanceInput = '';

    async function triggerAiGoalGen(guidance) {
        lastGuidanceInput = guidance || '';
        loadingOverlay.style.display = 'flex';
        try {
            // Resolve connection and reading strategy based on active mode
            const cfg = await getActiveModeConfig('goals');
            const connId = cfg.useCustomConnection ? cfg.connectionId : 'global';
            const readingOverrides = cfg.useCustomReading ? cfg.reading : {};
            
            // Build context
            const context = await buildContext(readingOverrides);
            context.guidance = lastGuidanceInput;
            
            // Prompt construction using assemblePrompt with active mode's generation preset ID
            const presetId = cfg.generationPresetId || 'default';
            const blocks = getBlocks('goals_ai_gen', presetId);
            
            if (blocks.length === 0) {
                throw new Error("当前绑定的目标生成预设未配置任何提示词卡片，请先前往『提示词工作台』添加至少一个提示词块！");
            }
            
            const promptParts = assemblePrompt('goals_ai_gen', context, {}, presetId);
            const responseText = await callAI(promptParts.messages, '', connId);
            console.log('[Plot Goals] AI response:', responseText);
            
            const list = extractJsonArray(responseText);
            if (Array.isArray(list)) {
                tempGeneratedGoals = list.filter(item => item.title);
                if (tempGeneratedGoals.length === 0) {
                    throw new Error('AI 未能生成任何有效目标，请修改提示词或引导词重试');
                }
                
                // Render preview list
                previewList.innerHTML = tempGeneratedGoals.map(item => `
                    <div style="padding: 8px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--SmartThemeBorderColor); border-radius: 4px; display: flex; flex-direction: column; gap: 3px;">
                        <div style="font-weight: bold; font-size: 0.92em; color: var(--SmartThemeEmColor);">${escapeHtml(item.title)}</div>
                        ${item.description ? `<div style="font-size: 0.78em; opacity: 0.65; line-height: 1.4;">${escapeHtml(item.description)}</div>` : ''}
                    </div>
                `).join('');
                
                previewModal.style.display = 'flex';
            } else {
                throw new Error('AI 返回的不是有效的 JSON 数组');
            }
        } catch (err) {
            console.error('[Plot Goals] AI Goal Generation failed:', err);
            alert(`AI 生成目标失败: ${err.message || err}`);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    aiGenBtn.addEventListener('click', () => {
        showAiGuidanceModal(triggerAiGoalGen);
    });

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (confirm("是否确定清空当前聊天的所有任务目标？此操作不可撤销！")) {
                set('goals', {});
                savePlotData();
                renderGoalTreeUI();
                document.dispatchEvent(new CustomEvent('plot:storeUpdated', { 
                    detail: { changed: { source: 'goal_clear_all' } } 
                }));
            }
        });
    }
    
    // Bind Preview Dialog Buttons
    previewClose.addEventListener('click', () => {
        previewModal.style.display = 'none';
    });
    
    previewRegen.addEventListener('click', () => {
        previewModal.style.display = 'none';
        triggerAiGoalGen(lastGuidanceInput);
    });
    
    previewAppend.addEventListener('click', () => {
        if (tempGeneratedGoals.length === 0) return;
        
        tempGeneratedGoals.forEach(item => {
            createGoal({
                ...item,
                title: item.title,
                description: item.description || '',
                parentId: item.parentId || null,
                status: item.status || 'active',
                type: item.type || 'manual',
                conditions: item.conditions || { variable: '', keywords: [] },
                actions: item.actions || []
            });
        });
        
        tempGeneratedGoals = []; // Clear immediately to prevent double-click duplication
        previewModal.style.display = 'none';
        renderGoalTreeUI();
        getContext().saveSettingsDebounced?.();
    });

    // ── 7. Chat Change / Selection listener ──
    const ctx = getContext();
    if (ctx && ctx.eventSource && ctx.eventTypes) {
        ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, async () => {
            if (document.getElementById('plot-goals-tree-container')) {
                await refreshModeSelector();
                renderGoalTreeUI();
            }
        });
    }

    // Initial Render
    await refreshModeSelector();
    renderGoalTreeUI();
}

// ── Recursive DOM Tree Builder ────────────────────────────────────────────────

function buildGoalNodeDOM(goal, goalsMap, displayCfg = { showDesc: false, showStatus: true, showType: false }) {
    const isRoot = !goal.parentId || !goalsMap[goal.parentId];
    const node = document.createElement('div');
    node.className = 'plot-goal-node';
    node.dataset.id = goal.id;
    if (isRoot) {
        node.style.cssText = 'margin-left: 0; border-left: none; padding-left: 0; margin-bottom: 6px;';
    } else {
        node.style.cssText = 'margin-left: 16px; border-left: 1px dashed var(--SmartThemeBorderColor); padding-left: 8px; margin-bottom: 6px;';
    }
    
    const row = document.createElement('div');
    row.className = 'plot-goal-row';
    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.02); gap: 8px;';
    
    // Hover highlight effect
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.06)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'rgba(255,255,255,0.02)'; });
    
    // Left section: folding + checkbox + title + badges
    const leftSide = document.createElement('div');
    leftSide.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;';
    
    const getNum = (id) => {
        const match = id.match(/g_(\d+)/) || id.match(/goal_(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    };
    const children = Object.values(goalsMap)
        .filter(g => g.parentId === goal.id)
        .sort((a, b) => {
            const numA = getNum(a.id);
            const numB = getNum(b.id);
            if (numA !== numB) return numA - numB;
            return a.id.localeCompare(b.id);
        });
    const hasChildren = children.length > 0;
    
    const foldIcon = document.createElement('i');
    if (hasChildren) {
        foldIcon.className = 'fa-solid fa-chevron-down plot-goal-fold-icon';
        foldIcon.style.cssText = 'cursor: pointer; font-size: 0.8em; color: var(--SmartThemeEmColor); width: 12px; text-align: center;';
    } else {
        foldIcon.className = 'fa-regular fa-circle-dot';
        foldIcon.style.cssText = 'font-size: 0.65em; opacity: 0.4; width: 12px; text-align: center;';
    }
    leftSide.appendChild(foldIcon);
    
    // Checkbox
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.style.cssText = 'cursor: pointer; margin: 0; transform: scale(1.05);';
    chk.checked = goal.status === 'complete';
    leftSide.appendChild(chk);
    
    // Title
    const titleEl = document.createElement('span');
    titleEl.textContent = goal.title;
    titleEl.title = goal.description || '无任务描述';
    titleEl.style.cssText = 'font-size: 0.88em; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;';
    
    if (goal.status === 'complete') {
        titleEl.style.textDecoration = 'line-through';
        titleEl.style.opacity = '0.5';
    } else if (goal.status === 'failed') {
        titleEl.style.color = 'var(--SmartThemeQuoteColor)';
        titleEl.style.opacity = '0.75';
    } else if (goal.status === 'hidden') {
        titleEl.style.opacity = '0.35';
    }
    
    const extraKeys = Object.keys(goal).filter(k => !['id', 'parentId', 'title', 'description', 'status', 'type', 'conditions', 'actions'].includes(k));
    const hasExtras = extraKeys.some(k => goal[k] !== undefined && goal[k] !== null && goal[k] !== '');
    
    if ((displayCfg.showDesc && goal.description) || hasExtras) {
        const textContainer = document.createElement('div');
        textContainer.style.cssText = 'display: flex; flex-direction: column; flex: 1; min-width: 0;';
        
        titleEl.style.flex = 'initial';
        textContainer.appendChild(titleEl);
        
        if (displayCfg.showDesc && goal.description) {
            const descEl = document.createElement('div');
            descEl.textContent = goal.description;
            descEl.style.cssText = 'font-size: 0.72em; opacity: 0.55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;';
            textContainer.appendChild(descEl);
        }
        
        if (hasExtras) {
            const extraContainer = document.createElement('div');
            extraContainer.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px;';
            extraKeys.forEach(k => {
                const val = goal[k];
                if (val !== undefined && val !== null && val !== '') {
                    const badge = document.createElement('span');
                    
                    // Fetch label and color from customBadges
                    const globalBadges = getContext().extensionSettings?.plot?.customBadges || {};
                    const configEntry = globalBadges[k];
                    
                    const labelMap = { reward: '奖励', rewards: '奖励', awards: '奖励', innerVoice: '心声', exp: '经验', clue: '线索' };
                    const label = configEntry?.label || labelMap[k] || k;
                    
                    let badgeColor = configEntry?.color || 'var(--SmartThemeEmColor)';
                    badge.style.cssText = `font-size: 0.65em; padding: 1px 4px; border-radius: 3px; background: rgba(0,0,0,0.15); border: 1px solid ${badgeColor}; color: ${badgeColor}; font-weight: bold;`;
                    
                    badge.textContent = `${label}: ${val}`;
                    extraContainer.appendChild(badge);
                }
            });
            textContainer.appendChild(extraContainer);
        }
        
        leftSide.appendChild(textContainer);
    } else {
        leftSide.appendChild(titleEl);
    }
    
    // Type Badge
    if (displayCfg.showType) {
        const typeLabelMap = { manual: '手', variable: '参', keyword: '词', ai: '智' };
        const typeTitleMap = { manual: '手动完成任务', variable: '条件表达式判定', keyword: '关键词匹配判定', ai: 'AI后台判定' };
        const typeBadge = document.createElement('span');
        typeBadge.textContent = typeLabelMap[goal.type] || '手';
        typeBadge.title = typeTitleMap[goal.type] || '手动任务';
        typeBadge.style.cssText = 'font-size: 0.62em; font-weight: bold; padding: 1px 3px; border-radius: 3px; background: rgba(0,0,0,0.25); color: var(--SmartThemeBodyColor); border: 1px solid var(--SmartThemeBorderColor); cursor: help;';
        leftSide.appendChild(typeBadge);
    }
    
    // Status Badge
    let statusBadge = null;
    if (displayCfg.showStatus) {
        statusBadge = document.createElement('span');
        const statusStr = goal.status || 'active';
        let statusText = '进行中';
        let statusBg = 'rgba(80,120,220,0.12)';
        let statusColor = 'var(--SmartThemeBodyColor)';
        if (statusStr === 'complete') {
            statusText = '已完成';
            statusBg = 'rgba(76,175,80,0.12)';
            statusColor = '#4caf50';
        } else if (statusStr === 'failed') {
            statusText = '已失败';
            statusBg = 'rgba(244,67,54,0.12)';
            statusColor = 'var(--SmartThemeQuoteColor)';
        } else if (statusStr === 'hidden') {
            statusText = '已隐藏';
            statusBg = 'rgba(128,128,128,0.12)';
            statusColor = '#888888';
        }
        statusBadge.textContent = statusText;
        statusBadge.style.cssText = `font-size: 0.65em; font-weight: bold; padding: 1px 4px; border-radius: 3px; background: ${statusBg}; color: ${statusColor}; border: 1px solid transparent;`;
        leftSide.appendChild(statusBadge);
    }
    
    row.appendChild(leftSide);
    
    // Right section: actions
    const rightSide = document.createElement('div');
    rightSide.style.cssText = 'display: flex; align-items: center; gap: 4px;';
    
    const configBtn = document.createElement('button');
    configBtn.className = 'menu_button plot-btn';
    configBtn.style.cssText = 'padding: 2px 5px; font-size: 0.78em;';
    configBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
    configBtn.title = '配置详情';
    rightSide.appendChild(configBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'menu_button plot-btn';
    deleteBtn.style.cssText = 'padding: 2px 5px; font-size: 0.78em; color: var(--SmartThemeQuoteColor);';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.title = '删除目标';
    rightSide.appendChild(deleteBtn);
    
    row.appendChild(rightSide);
    node.appendChild(row);
    
    // Children list container
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'plot-goal-children';
    childrenContainer.style.display = 'block';
    
    children.forEach(child => {
        childrenContainer.appendChild(buildGoalNodeDOM(child, goalsMap, displayCfg));
    });
    node.appendChild(childrenContainer);
    
    // Bind accordion fold/unfold click
    if (hasChildren) {
        foldIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = childrenContainer.style.display !== 'none';
            childrenContainer.style.display = isOpen ? 'none' : 'block';
            foldIcon.className = isOpen ? 'fa-solid fa-chevron-right plot-goal-fold-icon' : 'fa-solid fa-chevron-down plot-goal-fold-icon';
        });
    }
    
    const hasActiveDescendants = (nodeId) => {
        const ch = Object.values(goalsMap).filter(g => g.parentId === nodeId);
        return ch.some(c => (c.status === 'active' || !c.status) || hasActiveDescendants(c.id));
    };

    // Bind status toggle
    chk.addEventListener('change', () => {
        const nextStatus = chk.checked ? 'complete' : 'active';
        
        // Zero-latency instant visual feedback in DOM
        if (nextStatus === 'complete') {
            titleEl.style.textDecoration = 'line-through';
            titleEl.style.opacity = '0.5';
            if (statusBadge) {
                statusBadge.textContent = '已完成';
                statusBadge.style.background = 'rgba(76,175,80,0.12)';
                statusBadge.style.color = '#4caf50';
            }
        } else {
            titleEl.style.textDecoration = 'none';
            titleEl.style.opacity = '1';
            if (statusBadge) {
                statusBadge.textContent = '进行中';
                statusBadge.style.background = 'rgba(80,120,220,0.12)';
                statusBadge.style.color = 'var(--SmartThemeBodyColor)';
            }
        }
        
        isSelfUpdatingGoalStatus = true;
        setGoalStatus(goal.id, nextStatus);
        
        setTimeout(() => {
            isSelfUpdatingGoalStatus = false;
        }, 350);
        
        // Under 'active' filter, check if the task needs to be hidden from the DOM without full redrawing
        if (activeFilter === 'active') {
            const activeDesc = hasActiveDescendants(goal.id);
            if (!activeDesc) {
                // Fade out and remove the node
                node.style.transition = 'all 0.3s ease';
                node.style.opacity = '0';
                node.style.maxHeight = '0';
                node.style.padding = '0';
                node.style.margin = '0';
                node.style.overflow = 'hidden';
                setTimeout(() => {
                    node.remove();
                    // If container is now empty, render empty message
                    const container = rootEl.querySelector('#plot-goals-tree-container');
                    if (container && container.children.length === 0) {
                        container.innerHTML = `<div style="text-align:center; padding:30px; font-size:0.85em; opacity:0.7;"><i class="fa-solid fa-filter"></i> 无匹配该状态过滤的目标。</div>`;
                    }
                }, 300);
            }
        }
    });
    
    // Bind actions
    configBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openConfigDrawer(goal.id);
    });
    
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`确定要物理删除任务【${goal.title}】吗？其直属的子目标会被解脱从属，转为根大任务，不会被一并删除。`)) {
            deleteGoal(goal.id);
            getContext().saveSettingsDebounced?.();
            document.dispatchEvent(new CustomEvent('plot:storeUpdated', { detail: { changed: { source: 'goal_delete' } } }));
        }
    });
    
    return node;
}

// ── Render Tree Control ───────────────────────────────────────────────────────

function extractJsonArray(text) {
    let clean = text.trim();
    
    // Remove markdown code blocks
    clean = clean.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    
    // Find boundaries of JSON array
    const startIdx = clean.indexOf('[');
    const endIdx = clean.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        throw new Error('未能在 AI 返回中找到有效的 JSON 数组框 [ ]');
    }
    clean = clean.slice(startIdx, endIdx + 1);
    
    // Remove trailing commas in JSON objects/arrays which violate strict JSON parsing
    clean = clean.replace(/,\s*([\]}])/g, '$1');
    
    return JSON.parse(clean);
}

// B10 Fix: replace the broken requestAnimationFrame+Promise-chain debounce with a
// proper setTimeout-based debounce. The old approach still executed ALL queued renders
// because cancelAnimationFrame only cancelled the last scheduled frame while the
// promise chain kept all previous closures alive.
let _renderGoalTreeTimer = null;

function renderGoalTreeUI() {
    if (_renderGoalTreeTimer) clearTimeout(_renderGoalTreeTimer);
    _renderGoalTreeTimer = setTimeout(async () => {
        _renderGoalTreeTimer = null;
        try {
        const container = rootEl?.querySelector('#plot-goals-tree-container');
        if (!container) return;
        
        const goals = get('goals') || {};
        const goalList = Object.values(goals);
        
        container.innerHTML = '';
        
        // Update parent list dropdowns in Quick Adder
        refreshParentSelects();
        
        if (goalList.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:30px; font-size:0.9em; color:var(--SmartThemeEmColor);"><i class="fa-solid fa-clipboard-list"></i> 当前暂无剧情目标，请在下方添加！</div>`;
            return;
        }
        
        // Load display configs
        const cfg = await getActiveModeConfig('goals');
        const displayCfg = cfg.display || { showDesc: false, showStatus: true, showType: false };
        
        // Build tree index. Find root goals (parentId is null or parentId points to a deleted goal)
        const roots = goalList.filter(g => !g.parentId || !goals[g.parentId]);
        
        // Filter tree logic based on activeFilter
        const filteredRoots = roots.filter(root => {
            if (activeFilter === 'all') return true;
            
            // Recursive helper to check if this node matches filter
            const matchFilter = (node) => {
                if (activeFilter === 'active') return node.status === 'active' || !node.status;
                return node.status === activeFilter;
            };
            
            // Recursive helper to check if any child matches filter
            const anyDescendantMatches = (nodeId) => {
                const ch = goalList.filter(g => g.parentId === nodeId);
                return ch.some(c => matchFilter(c) || anyDescendantMatches(c.id));
            };
            
            return matchFilter(root) || anyDescendantMatches(root.id);
        });
        
        if (filteredRoots.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:30px; font-size:0.85em; opacity:0.7;"><i class="fa-solid fa-filter"></i> 无匹配该状态过滤的目标。</div>`;
            return;
        }
        
        // Stable sort chronologically by ID timestamp and append root elements
        filteredRoots
            .sort((a, b) => {
                const getNum = (id) => {
                    const match = id.match(/g_(\d+)/) || id.match(/goal_(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                };
                const numA = getNum(a.id);
                const numB = getNum(b.id);
                if (numA !== numB) return numA - numB;
                return a.id.localeCompare(b.id);
            })
            .forEach(root => {
                container.appendChild(buildGoalNodeDOM(root, goals, displayCfg));
            });
        } catch (err) {
            console.error('[Plot Goals] renderGoalTreeUI failed:', err);
        }
    }, 50);
}

// ── Refresh Parent Dropdowns ───────────────────────────────────────────────────

function refreshParentSelects() {
    // No-op since quick parent selector is removed
}

// ── Configuration Drawer Open & Action Rows Manager ──────────────────────────

function openConfigDrawer(goalId = null) {
    const goals = get('goals') || {};
    
    const isNew = !goalId;
    const tempId = isNew ? 'goal_' + Date.now() : goalId;
    const goal = isNew ? {
        id: tempId,
        title: '',
        description: '',
        parentId: '',
        type: 'manual',
        conditions: { variable: '', keywords: [] },
        actions: []
    } : goals[goalId];
    
    if (!goal) return;
    
    const configDrawer = rootEl.querySelector('#plot-goal-config-drawer');
    
    // 1. Populate standard values
    rootEl.querySelector('#plot-drawer-goal-id').value = goal.id;
    rootEl.querySelector('#plot-drawer-goal-title').value = goal.title || '';
    rootEl.querySelector('#plot-drawer-goal-desc').value = goal.description || '';
    
    // Status history log box
    const detailGroup = rootEl.querySelector('#plot-drawer-completion-detail-group');
    const detailText = rootEl.querySelector('#plot-drawer-completion-detail-text');
    if (detailGroup && detailText) {
        if (goal.completedDetail) {
            detailGroup.style.display = 'flex';
            detailText.textContent = goal.completedDetail.replace(/\\n/g, '\n');
            if (goal.status === 'complete') {
                detailGroup.style.background = 'rgba(76,175,80,0.12)';
                detailGroup.style.borderColor = 'rgba(76,175,80,0.3)';
                detailGroup.querySelector('label').style.color = '#4caf50';
            } else if (goal.status === 'failed') {
                detailGroup.style.background = 'rgba(244,67,54,0.12)';
                detailGroup.style.borderColor = 'rgba(244,67,54,0.3)';
                detailGroup.querySelector('label').style.color = 'var(--SmartThemeQuoteColor)';
            } else {
                detailGroup.style.background = 'rgba(0,0,0,0.15)';
                detailGroup.style.borderColor = 'var(--SmartThemeBorderColor)';
                detailGroup.querySelector('label').style.color = 'var(--SmartThemeEmColor)';
            }
        } else {
            detailGroup.style.display = 'none';
        }
    }
    
    // Status dropdown
    const statusSelect = rootEl.querySelector('#plot-drawer-goal-status');
    if (statusSelect) {
        statusSelect.value = goal.status || 'active';
    }
    
    // 2. Populate parent dropdown (exclude current goal and its sub-goals to prevent cycles)
    const cycleFreeGoals = Object.values(goals).filter(g => {
        if (isNew) return true;
        if (g.id === goalId) return false;
        
        const isDescendant = (childId, parentId) => {
            const child = goals[childId];
            if (!child || !child.parentId) return false;
            if (child.parentId === parentId) return true;
            return isDescendant(child.parentId, parentId);
        };
        
        return !isDescendant(g.id, goalId);
    });
    
    const parentSelect = rootEl.querySelector('#plot-drawer-goal-parent');
    parentSelect.innerHTML = `
        <option value="">-- 无父目标 --</option>
        ${cycleFreeGoals.map(g => `<option value="${g.id}">${escapeHtml(g.title)}</option>`).join('')}
    `;
    parentSelect.value = goal.parentId || '';
    
    // 3. Type Selection & Condition triggers
    const typeSelect = rootEl.querySelector('#plot-drawer-goal-type');
    typeSelect.value = goal.type || 'manual';
    
    rootEl.querySelector('#plot-drawer-cond-variable-group').style.display = goal.type === 'variable' ? 'flex' : 'none';
    rootEl.querySelector('#plot-drawer-cond-keyword-group').style.display = goal.type === 'keyword' ? 'flex' : 'none';
    
    // Fill values
    rootEl.querySelector('#plot-drawer-cond-variable-expr').value = goal.conditions?.variable || '';
    rootEl.querySelector('#plot-drawer-cond-variable-expr-fail').value = goal.conditions?.variableFail || '';
    rootEl.querySelector('#plot-drawer-cond-keywords').value = Array.isArray(goal.conditions?.keywords) 
        ? goal.conditions.keywords.join(', ') 
        : '';
    rootEl.querySelector('#plot-drawer-cond-keywords-fail').value = Array.isArray(goal.conditions?.keywordsFail) 
        ? goal.conditions.keywordsFail.join(', ') 
        : '';
        
    // 4. Action list loading
    const actionListContainer = rootEl.querySelector('#plot-drawer-action-list');
    actionListContainer.innerHTML = '';
    actionRowCompilers = [];
    
    const actions = goal.actions || [];
    actions.forEach(action => {
        const rowObj = createActionRowDOM(action, tempId);
        actionListContainer.appendChild(rowObj.dom);
        actionRowCompilers.push(rowObj.getActionConfig);
    });
    
    // Render custom fields
    const customFieldsList = rootEl.querySelector('#plot-drawer-custom-fields-list');
    if (customFieldsList) {
        customFieldsList.innerHTML = '';
        const renderCustomFieldRow = (key = '', val = '') => {
            const row = document.createElement('div');
            row.className = 'plot-custom-field-row';
            row.style.cssText = 'display: flex; gap: 6px; align-items: center; width: 100%;';
            row.innerHTML = `
                <input type="text" class="plot-input field-key" placeholder="属性名(如 reward)" value="${escapeHtml(key)}" style="flex: 1; font-size: 0.85em; padding: 4px 6px;">
                <input type="text" class="plot-input field-val" placeholder="属性值" value="${escapeHtml(val)}" style="flex: 2; font-size: 0.85em; padding: 4px 6px;">
                <i class="fa-solid fa-trash-can field-delete" style="cursor: pointer; color: var(--SmartThemeQuoteColor); font-size: 0.9em; padding: 0 4px;" title="删除属性"></i>
            `;
            row.querySelector('.field-delete').addEventListener('click', () => row.remove());
            customFieldsList.appendChild(row);
        };
        const extraKeys = Object.keys(goal).filter(k => !['id', 'parentId', 'title', 'description', 'status', 'type', 'conditions', 'actions'].includes(k));
        extraKeys.forEach(k => {
            renderCustomFieldRow(k, goal[k]);
        });
    }



    // 5. Slide show Drawer
    configDrawer.style.display = 'flex';
    setTimeout(() => { configDrawer.classList.add('show'); }, 10);
}

// ── Action Row DOM Builder ─────────────────────────────────────────────────────

function createActionRowDOM(action = {}, goalId) {
    const row = document.createElement('div');
    row.className = 'plot-action-row';
    row.style.cssText = 'display: flex; gap: 6px; align-items: center; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; margin-bottom: 4px;';
    
    // Type dropdown
    const typeSelect = document.createElement('select');
    typeSelect.className = 'plot-select';
    typeSelect.style.cssText = 'font-size: 0.8em; height: 24px; padding: 0 4px; flex-shrink: 0;';
    typeSelect.innerHTML = `
        <option value="variable">修改变量</option>
        <option value="goal">控制目标</option>
        <option value="storyline">推进故事</option>
    `;
    typeSelect.value = action.type || 'variable';
    row.appendChild(typeSelect);
    
    // Target dropdown
    const targetSelect = document.createElement('select');
    targetSelect.className = 'plot-select';
    targetSelect.style.cssText = 'font-size: 0.8em; height: 24px; padding: 0 4px; flex: 1; min-width: 80px;';
    row.appendChild(targetSelect);
    
    // Op dropdown
    const opSelect = document.createElement('select');
    opSelect.className = 'plot-select';
    opSelect.style.cssText = 'font-size: 0.8em; height: 24px; padding: 0 4px; flex-shrink: 0;';
    row.appendChild(opSelect);
    
    // Value input
    const valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.className = 'plot-input';
    valInput.style.cssText = 'font-size: 0.8em; height: 24px; padding: 2px 6px; width: 50px; flex-shrink: 0;';
    valInput.value = action.value !== undefined ? action.value : '';
    row.appendChild(valInput);
    
    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'menu_button plot-btn';
    delBtn.style.cssText = 'padding: 2px 6px; font-size: 0.78em; color: var(--SmartThemeQuoteColor); flex-shrink: 0;';
    delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    row.appendChild(delBtn);
    
    // Function to populate sub-dropdowns based on type
    const refreshDropdowns = () => {
        const type = typeSelect.value;
        
        if (type === 'variable') {
            const vars = get('variables') || {};
            const varNames = Object.keys(vars);
            if (varNames.length === 0) {
                targetSelect.innerHTML = '<option value="">-- 无变量 --</option>';
            } else {
                targetSelect.innerHTML = varNames.map(name => `<option value="${name}">${name}</option>`).join('');
            }
            targetSelect.value = action.target || varNames[0] || '';
            
            opSelect.innerHTML = `
                <option value="add">+ 增加</option>
                <option value="sub">- 减少</option>
                <option value="set">= 设定</option>
                <option value="toggle">取反</option>
            `;
            opSelect.value = action.op || 'add';
            valInput.style.display = opSelect.value === 'toggle' ? 'none' : 'block';
            
        } else if (type === 'goal') {
            const goals = get('goals') || {};
            const availableGoals = Object.values(goals).filter(g => g.id !== goalId);
            if (availableGoals.length === 0) {
                targetSelect.innerHTML = '<option value="">-- 无其他目标 --</option>';
            } else {
                targetSelect.innerHTML = availableGoals.map(g => `<option value="${g.id}">${escapeHtml(g.title)}</option>`).join('');
            }
            targetSelect.value = action.target || (availableGoals[0]?.id || '');
            
            opSelect.innerHTML = `
                <option value="unlock">解锁任务</option>
                <option value="complete">标记完成</option>
                <option value="failed">标记失败</option>
            `;
            opSelect.value = action.op || 'unlock';
            valInput.style.display = 'none';
            
        } else if (type === 'storyline') {
            const storylines = get('storylines') || {};
            const sls = Object.values(storylines);
            if (sls.length === 0) {
                targetSelect.innerHTML = '<option value="main">主线故事</option>';
            } else {
                targetSelect.innerHTML = sls.map(s => `<option value="${s.id}">${escapeHtml(s.title)}</option>`).join('');
            }
            targetSelect.value = action.target || (sls[0]?.id || 'main');
            
            opSelect.innerHTML = `
                <option value="advance">推进故事线</option>
            `;
            opSelect.value = 'advance';
            valInput.style.display = 'none';
        }
    };
    
    typeSelect.addEventListener('change', () => {
        action.target = '';
        action.op = '';
        refreshDropdowns();
    });
    
    opSelect.addEventListener('change', () => {
        valInput.style.display = opSelect.value === 'toggle' ? 'none' : 'block';
    });
    
    delBtn.addEventListener('click', () => {
        row.remove();
        // Remove compiler from array
        const idx = actionRowCompilers.indexOf(getActionConfig);
        if (idx !== -1) {
            actionRowCompilers.splice(idx, 1);
        }
    });
    
    refreshDropdowns();
    
    const getActionConfig = () => {
        return {
            type: typeSelect.value,
            target: targetSelect.value,
            op: opSelect.value,
            value: valInput.style.display === 'none' || opSelect.value === 'toggle' ? '' : valInput.value
        };
    };
    
    return {
        dom: row,
        getActionConfig
    };
}

function showAiGuidanceModal(onSave) {
    let overlay = document.getElementById('plot-goal-ai-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'plot-goal-ai-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(var(--SmartThemeBlurTintColor-rgb, 20,20,30), 0.9);
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
                <div style="font-weight: bold; color: var(--SmartThemeEmColor); border-bottom: 1px solid var(--SmartThemeBorderColor); padding-bottom: 6px; margin-bottom: 4px; font-size:0.95em;"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 目标生成引导</div>
                <div class="plot-setting-group">
                    <label class="plot-label" style="font-size: 0.8em;">附加生成引导（可选）</label>
                    <textarea id="plot-goal-ai-guidance-input" class="plot-input" placeholder="例如：侧重于战斗准备，或关注好感度提升" rows="3" style="width:100%; font-size:0.85em; resize:none;"></textarea>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                    <button id="plot-goal-ai-m-cancel" class="plot-btn" style="font-size:0.85em; padding:4px 10px;">取消</button>
                    <button id="plot-goal-ai-m-save" class="plot-btn" style="font-size:0.85em; padding:4px 10px; border-color: var(--SmartThemeEmColor); color: var(--SmartThemeEmColor);">开始生成</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    
    const input = overlay.querySelector('#plot-goal-ai-guidance-input');
    input.value = '';
    overlay.style.display = 'flex';
    
    const saveBtn = overlay.querySelector('#plot-goal-ai-m-save');
    const cancelBtn = overlay.querySelector('#plot-goal-ai-m-cancel');
    
    const newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    
    newSave.addEventListener('click', () => {
        const val = input.value.trim();
        onSave(val);
        overlay.style.display = 'none';
    });
    
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    newCancel.addEventListener('click', () => {
        overlay.style.display = 'none';
    });
}
