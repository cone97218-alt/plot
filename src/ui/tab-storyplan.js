/**
 * tab-storyplan.js - 剧情规划 Tab
 *
 * 三个子模块：
 *   日程 (storyplan_events)  —— Day1/2/3/Future 事件卡，三色分类，u/c 双视角
 *   脉络 (storyplan_threads) —— 平行故事线，萌芽→发酵→逼近→已爆发 四态
 *   世界 (storyplan_outline) —— 全景大纲，~8节点，Beat/Scene/Subtext/Think 四层
 *
 * 存储：IndexedDB，key 格式 chat_{charId}_{chatId}_sp_{type}
 * 提示词：复用 tab-prompts 预设系统（模块ID: storyplan_events / storyplan_threads / storyplan_outline）
 * 连接：每次生成前从顶部 Config Bar 读取（支持 default + 自定义）
 */

import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../../../extensions.js';
import { callAI, callAIStream, listConnections, getConnection } from '../core/api-client.js';
import { buildContext } from '../core/context-reader.js';
import { assemblePrompt, resolvePlaceholders, getBlocks } from '../core/prompt-builder.js';
import { getPlotValue, savePlotValue } from '../core/indexeddb.js';
import { createModuleConfigDrawer, getActiveModeConfig } from './module-config-drawer.js';
import { injectSingleItemToChatInput } from '../core/injector.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const MODULE_IDS = {
    events:  'storyplan_events',
    threads: 'storyplan_threads',
    outline: 'storyplan_outline',
};

const EVENT_TYPES = {
    '明线': { color: 'sp-card-mingxian', label: '明线', icon: 'fa-sun' },
    '暗线': { color: 'sp-card-anxian',   label: '暗线', icon: 'fa-moon' },
    '红线': { color: 'sp-card-hongxian', label: '红线', icon: 'fa-heart' },
};

const DAY_KEYS   = ['day1', 'day2', 'day3', 'future'];
const DAY_LABELS = { day1: 'Day 1', day2: 'Day 2', day3: 'Day 3', future: 'Future' };

const THREAD_STATUSES = ['萌芽', '发酵', '逼近', '已爆发'];
const THREAD_SCALES   = ['微观', '中观', '宏观'];

// ── State ─────────────────────────────────────────────────────────────────────

let _pane        = null;   // root pane element injected by panel.js
let _activeTab   = localStorage.getItem('plot_sp_active_tab') || 'events';
let _perspective = localStorage.getItem('plot_sp_perspective') || 'u';
let _generating  = { events: false, threads: false, outline: false };
let _drawerController = null;
let _isLocked    = localStorage.getItem('plot_sp_locked') !== 'false'; // 默认 true (锁定)

function applyLockState(container) {
    const pane = container || _pane;
    if (!pane) return;

    const lockBtn = pane.querySelector('#sp-lock-toggle-btn');
    if (lockBtn) {
        const icon = lockBtn.querySelector('i');
        if (icon) {
            icon.className = _isLocked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
        }
        lockBtn.classList.toggle('active', !_isLocked);
        lockBtn.title = _isLocked ? '当前处于锁定状态（点击解锁后方可修改内容）' : '当前已解锁编辑（点击锁定）';
        lockBtn.style.color = _isLocked ? '' : '#f59e0b';
        lockBtn.style.borderColor = _isLocked ? '' : '#f59e0b';
    }

    // Toggle contenteditable for editable text blocks
    pane.querySelectorAll('[contenteditable]').forEach(el => {
        el.setAttribute('contenteditable', _isLocked ? 'false' : 'true');
    });

    // Toggle input, textarea, select for form fields
    pane.querySelectorAll('.plot-input, .plot-select, .sp-node-branches-input, .sp-thread-desc, .sp-thread-next, .sp-thread-chars, .sp-thread-tension-range').forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.readOnly = _isLocked;
        } else if (el.tagName === 'SELECT') {
            el.disabled = _isLocked;
        }
    });
}

// ── DB key helper ──────────────────────────────────────────────────────────────

function getSPKey(type) {
    const ctx = getContext();
    const charId = ctx.characterId ?? 'none';
    const chatId = ctx.getCurrentChatId?.() || 'unknown';
    return `chat_${charId}_${chatId}_sp_${type}`;
}

// ── Load / save helpers ───────────────────────────────────────────────────────

async function loadData(type) {
    return await getPlotValue(getSPKey(type)) || null;
}

async function saveData(type, data) {
    await savePlotValue(getSPKey(type), data);
}

// ── Connection helpers ─────────────────────────────────────────────────────────

function getSelectedConnectionId() {
    return extension_settings.plot?.defaultConnectionId || 'default';
}

function isStreamEnabled(moduleId) {
    return extension_settings.plot?.streamModules?.[moduleId] !== false;
}

function getSelectedPresetId(moduleId) {
    const s = extension_settings.plot;
    return s?.currentPreset?.[moduleId] || 'default';
}

// ── Prompt building ───────────────────────────────────────────────────────────

/**
 * Build messages array for a given SP module using the preset block system.
 */
async function buildPromptMessages(moduleId, extraPlaceholders = {}) {
    const mode = await getActiveModeConfig('storyplan');
    const readingConfig = mode.useCustomReading ? (mode.reading || {}) : {};

    const ctx = await buildContext(readingConfig);
    const merged = { ...ctx, ...extraPlaceholders };

    const presetId = mode.presetId || getSelectedPresetId(moduleId);
    const assembled = assemblePrompt(moduleId, merged, {}, presetId);

    return assembled.messages || [];
}

// ── Streaming helpers ──────────────────────────────────────────────────────────

/**
 * Call AI with streaming or non-streaming depending on toggle.
 * Returns the full response text.
 */
async function callAIWithSettings(messages, moduleId) {
    const mode = await getActiveModeConfig('storyplan');
    const connId = (mode.useCustomConnection && mode.connectionId) ? mode.connectionId : getSelectedConnectionId();
    const stream = isStreamEnabled(moduleId);

    if (stream) {
        let full = '';
        for await (const chunk of callAIStream(messages, '', connId)) {
            full += chunk;
        }
        return full;
    } else {
        return await callAI(messages, '', connId);
    }
}

function parseJsonResponse(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('AI 未返回有效内容，请检查 API 连接及模型响应');
    }
    let cleaned = text.trim();
    
    // 1. 优先提取 ```json ... ``` 包裹的部分
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
    }
    
    // 2. 提取最外层匹配的 { ... } 或 [ ... ]
    const firstBrace = cleaned.indexOf('{');
    const lastBrace  = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        try {
            // 尝试去除末尾多余逗号和控制字符
            const sanitized = cleaned
                .replace(/,\s*([}\]])/g, '$1')
                .replace(/[\u0000-\u001F]+/g, ' ');
            return JSON.parse(sanitized);
        } catch (e2) {
            console.error('[Plot SP] Parse JSON Error raw response:', text);
            throw new Error('AI 返回格式解析失败，请检查模型输出');
        }
    }
}

// ── 日程 module ───────────────────────────────────────────────────────────────

async function initEventsPane(pane) {
    // Load saved data
    const saved = await loadData('events');
    if (saved) {
        pane._eventsData = saved;
        renderEventsData(saved, pane);
    }

    // Perspective toggle
    pane.querySelectorAll('.sp-persp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _perspective = btn.dataset.persp;
            localStorage.setItem('plot_sp_perspective', _perspective);
            pane.querySelectorAll('.sp-persp-btn').forEach(b => b.classList.toggle('active', b.dataset.persp === _perspective));

            const saved2 = pane._eventsData;
            if (saved2) renderEventsData(saved2, pane);
        });
        btn.classList.toggle('active', btn.dataset.persp === _perspective);
    });

    // Generate button
    pane.querySelector('#sp-events-generate-btn')?.addEventListener('click', () => generateEvents(pane));

    // Add manual event card button
    pane.querySelector('#sp-events-add-btn')?.addEventListener('click', async () => {
        addManualEventCard(pane);
    });

    // Clear button
    pane.querySelector('#sp-events-clear-btn')?.addEventListener('click', async () => {
        pane._eventsData = null;
        await saveData('events', null);
        pane.querySelector('#sp-events-area').innerHTML = `
            <div class="sp-empty-hint" id="sp-events-empty">
                <i class="fa-solid fa-calendar-xmark" style="font-size:2em;opacity:0.3;"></i>
                <p>点击"AI 推演"，从当前剧情向后推演事件</p>
            </div>`;
    });
}

async function addManualEventCard(pane) {
    const data = pane._eventsData || {};
    const perspKey = _perspective === 'u' ? 'u_perspective' : 'c_perspective';
    if (!data[perspKey]) data[perspKey] = { day1: [], day2: [], day3: [], future: [] };
    if (!data[perspKey].day1) data[perspKey].day1 = [];

    const newEvt = {
        time_slot: '上午',
        type: '明线',
        title: '手动新建事件',
        location: '',
        characters: [],
        content: '在这里描述发生的事件...',
        side_activity: ''
    };

    data[perspKey].day1.unshift(newEvt);
    pane._eventsData = data;
    await saveData('events', data);
    renderEventsData(data, pane);
}

async function generateEvents(pane) {
    if (_generating.events) return;
    _generating.events = true;

    const btn = pane.querySelector('#sp-events-generate-btn');
    const area = pane.querySelector('#sp-events-area');

    setButtonLoading(btn, true);
    area.innerHTML = `<div class="sp-streaming-hint"><i class="fa-solid fa-circle-notch fa-spin"></i> AI 正在推演事件...</div>`;

    try {
        const messages = await buildPromptMessages(MODULE_IDS.events);
        const response = await callAIWithSettings(messages, MODULE_IDS.events);
        const data = parseJsonResponse(response);

        pane._eventsData = data;
        await saveData('events', data);
        renderEventsData(data, pane);
    } catch (err) {
        console.error('[SP Events] Generate failed:', err);
        area.innerHTML = `<div class="sp-error-hint"><i class="fa-solid fa-triangle-exclamation"></i> 生成失败：${escapeHtml(err.message)}</div>`;
    } finally {
        _generating.events = false;
        setButtonLoading(btn, false);
    }
}

function renderEventsData(data, pane) {
    const area = pane.querySelector('#sp-events-area');
    if (!area) return;

    const perspKey = _perspective === 'u' ? 'u_perspective' : 'c_perspective';
    const perspData = data[perspKey];

    area.innerHTML = '';

    // Render suggested action if available
    if (data.suggested_action) {
        const suggEl = document.createElement('div');
        suggEl.className = 'sp-events-suggestion';
        suggEl.innerHTML = `
            <i class="fa-solid fa-lightbulb" style="color:var(--SmartThemeEmColor); flex-shrink:0;"></i>
            <span style="font-size:0.84em; flex:1;">${escapeHtml(data.suggested_action)}</span>
        `;
        area.appendChild(suggEl);
    }

    if (!perspData) {
        area.insertAdjacentHTML('beforeend', `<div class="sp-empty-hint"><p>当前视角暂无数据</p></div>`);
        return;
    }

    DAY_KEYS.forEach(dayKey => {
        const events = perspData[dayKey];
        if (!events || events.length === 0) return;

        const section = document.createElement('div');
        section.className = 'sp-day-section';
        section.innerHTML = `<div class="sp-day-label">${DAY_LABELS[dayKey]}</div>`;

        events.forEach((evt, idx) => {
            const card = createEventCard(evt, dayKey, idx, data, pane, perspKey);
            section.appendChild(card);
        });

        area.appendChild(section);
    });

    if (area.children.length === (data.suggested_action ? 1 : 0)) {
        area.insertAdjacentHTML('beforeend', `<div class="sp-empty-hint"><p>当前视角暂无事件</p></div>`);
    }

    applyLockState(pane);
}

function createEventCard(evt, dayKey, idx, allData, pane, boundPerspKey) {
    const typeInfo = EVENT_TYPES[evt.type] || EVENT_TYPES['明线'];
    const card = document.createElement('div');
    card.className = `sp-card sp-card-${typeInfo.color.replace('sp-card-', '')}`;

    const timeSlotStr  = evt.time_slot || '全天';
    const locationStr  = evt.location  || '';
    const charsListStr = Array.isArray(evt.characters) ? evt.characters.join('、') : (evt.characters || '');

    card.innerHTML = `
        <div class="sp-card-header">
            <span class="sp-card-badge sp-badge-${evt.type || '明线'}" style="cursor:pointer;" title="点击切换类型（明线/暗线/红线）">${evt.type || '明线'}</span>
            <span class="sp-card-timeslot" contenteditable="true" spellcheck="false" title="编辑时间段">${escapeHtml(timeSlotStr)}</span>
            <span class="sp-card-title" contenteditable="true" spellcheck="false">${escapeHtml(evt.title || '')}</span>
            <div style="flex:1;"></div>
            <button class="sp-icon-btn sp-inject-btn ${evt.is_injected ? 'active' : ''}" title="${evt.is_injected ? '已开启主楼注入（点击取消）' : '点击开启主楼注入'}">
                <i class="fa-solid fa-bolt"></i>
            </button>
            <button class="sp-icon-btn sp-card-del-btn" title="删除事件卡" style="color:var(--SmartThemeQuoteColor);">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>

        <div class="sp-card-meta-row">
            <span class="sp-card-meta-item" title="场所地点">
                <span class="sp-card-location" contenteditable="true" spellcheck="false" placeholder="地点">${escapeHtml(locationStr || '暂无地点')}</span>
            </span>
            <span class="sp-card-meta-item" title="涉及人物" style="margin-left:auto;">
                <span class="sp-card-chars" contenteditable="true" spellcheck="false" placeholder="涉及人物">${escapeHtml(charsListStr || '暂无人物')}</span>
            </span>
        </div>

        <div class="sp-card-content" contenteditable="true" spellcheck="false">${escapeHtml(evt.content || '')}</div>

        <div class="sp-card-side">
            <span class="sp-card-side-content" contenteditable="true" spellcheck="false">${escapeHtml(evt.side_activity || '')}</span>
        </div>
    `;

    // Single-action per-event injection trigger
    const injectBtn = card.querySelector('.sp-inject-btn');
    injectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        injectBtn.classList.add('active');
        setTimeout(() => injectBtn.classList.remove('active'), 350);

        injectSingleItemToChatInput(evt, 'event');
    });

    // Click Badge to cycle type
    const badge = card.querySelector('.sp-card-badge');
    badge.addEventListener('click', async (e) => {
        e.stopPropagation();
        const types = ['明线', '暗线', '红线'];
        const curIdx = types.indexOf(evt.type || '明线');
        const nextType = types[(curIdx + 1) % types.length];
        evt.type = nextType;

        badge.textContent = nextType;
        badge.className = `sp-card-badge sp-badge-${nextType}`;
        const color = EVENT_TYPES[nextType]?.color || 'sp-card-mingxian';
        card.className = `sp-card sp-card-${color.replace('sp-card-', '')}`;

        const latest = pane._eventsData || {};
        if (latest[boundPerspKey]?.[dayKey]?.[idx]) {
            latest[boundPerspKey][dayKey][idx].type = nextType;
            await saveData('events', latest);
        }
    });

    // Delete Event Card (No prompt dialog)
    const delBtn = card.querySelector('.sp-card-del-btn');
    delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const latest = pane._eventsData || {};
        if (latest[boundPerspKey]?.[dayKey]) {
            latest[boundPerspKey][dayKey].splice(idx, 1);
            pane._eventsData = latest;
            await saveData('events', latest);
            renderEventsData(latest, pane);
        }
    });

    // Safe auto-save: always reference current pane._eventsData, locked strictly to boundPerspKey
    const saveEdit = debounce(async () => {
        const latest = pane._eventsData || {};
        if (!latest[boundPerspKey]) latest[boundPerspKey] = {};
        if (!latest[boundPerspKey][dayKey]) latest[boundPerspKey][dayKey] = [];

        const target = latest[boundPerspKey][dayKey][idx];
        if (!target) return;

        target.title         = card.querySelector('.sp-card-title')?.textContent.trim() || '';
        target.time_slot     = card.querySelector('.sp-card-timeslot')?.textContent.trim() || '全天';
        target.location      = card.querySelector('.sp-card-location')?.textContent.trim() || '';
        target.content       = card.querySelector('.sp-card-content')?.textContent.trim() || '';

        const charsStr = card.querySelector('.sp-card-chars')?.textContent.trim() || '';
        target.characters = charsStr ? charsStr.split(/[、,，]/).map(s => s.trim()).filter(Boolean) : [];

        const sideEl = card.querySelector('.sp-card-side-content');
        if (sideEl) {
            target.side_activity = sideEl.textContent.trim();
        }

        pane._eventsData = latest;
        await saveData('events', latest);
    }, 600);

    card.querySelectorAll('[contenteditable]').forEach(el => el.addEventListener('input', saveEdit));

    return card;
}

// ── 脉络 module ───────────────────────────────────────────────────────────────

async function initThreadsPane(pane) {
    const saved = await loadData('threads');
    if (saved?.threads) {
        pane._threadsData = saved;
        renderThreadsList(saved.threads, pane);
    }

    pane.querySelector('#sp-threads-generate-btn')?.addEventListener('click', () => generateThreads(pane));
    pane.querySelector('#sp-threads-add-btn')?.addEventListener('click', () => addManualThread(pane));
    pane.querySelector('#sp-threads-clear-btn')?.addEventListener('click', async () => {
        pane._threadsData = null;
        await saveData('threads', null);
        renderThreadsList([], pane);
    });
}

async function generateThreads(pane) {
    if (_generating.threads) return;
    _generating.threads = true;

    const btn  = pane.querySelector('#sp-threads-generate-btn');
    const list = pane.querySelector('#sp-threads-list');
    setButtonLoading(btn, true);
    list.innerHTML = `<div class="sp-streaming-hint"><i class="fa-solid fa-circle-notch fa-spin"></i> AI 正在分析故事脉络...</div>`;

    try {
        const messages = await buildPromptMessages(MODULE_IDS.threads);
        const response = await callAIWithSettings(messages, MODULE_IDS.threads);
        const data     = parseJsonResponse(response);

        // Merge with existing manual threads
        const existing = pane._threadsData?.threads || [];
        const aiThreads = (data.threads || []).map((t, i) => ({
            id:         `ai_${Date.now()}_${i}`,
            title:      t.title      || '未命名脉络',
            scale:      t.scale      || '微观',
            status:     t.status     || '萌芽',
            desc:       t.desc       || '',
            next_beat:  t.next_beat  || '',
            characters: t.characters || [],
            source:     'ai',
        }));

        const merged = [...existing.filter(t => t.source === 'manual'), ...aiThreads];
        pane._threadsData = { threads: merged };
        await saveData('threads', pane._threadsData);
        renderThreadsList(merged, pane);
    } catch (err) {
        console.error('[SP Threads] Generate failed:', err);
        list.innerHTML = `<div class="sp-error-hint"><i class="fa-solid fa-triangle-exclamation"></i> 生成失败：${escapeHtml(err.message)}</div>`;
    } finally {
        _generating.threads = false;
        setButtonLoading(btn, false);
    }
}

function addManualThread(pane) {
    const threads = pane._threadsData?.threads || [];
    const newThread = {
        id:         `manual_${Date.now()}`,
        title:      '新故事线',
        scale:      '微观',
        status:     '萌芽',
        desc:       '',
        next_beat:  '',
        characters: [],
        source:     'manual',
    };
    threads.push(newThread);
    pane._threadsData = { threads };
    saveData('threads', pane._threadsData);
    renderThreadsList(threads, pane);

    // Scroll to bottom and open the new thread
    setTimeout(() => {
        const lastItem = pane.querySelector('.sp-thread-item:last-child');
        lastItem?.scrollIntoView({ behavior: 'smooth' });
        lastItem?.querySelector('.sp-thread-header')?.click();
    }, 50);
}

function renderThreadsList(threads, pane) {
    const list = pane.querySelector('#sp-threads-list');
    if (!list) return;
    list.innerHTML = '';

    if (!threads || threads.length === 0) {
        list.innerHTML = `<div class="sp-empty-hint" id="sp-threads-empty">
            <i class="fa-solid fa-circle-nodes" style="font-size:2em;opacity:0.3;"></i>
            <p>点击"AI 识别脉络"，或手动添加一条故事线</p>
        </div>`;
        return;
    }

    threads.forEach((thread, idx) => {
        const item = createThreadItem(thread, idx, pane);
        list.appendChild(item);
    });

    applyLockState(pane);
}

function createThreadItem(thread, idx, pane) {
    const item = document.createElement('div');
    item.className = 'sp-thread-item';
    item.dataset.threadId = thread.id;

    const tensionVal = Math.min(100, Math.max(0, parseInt(thread.tension, 10) || 30));
    const statusClass = `sp-status-${thread.status || '萌芽'}`;
    const scaleClass  = `sp-scale-${thread.scale || '微观'}`;
    const categoryStr = thread.category || '主线';

    const getTensionColor = (v) => {
        if (v >= 80) return '#ff4d4f';
        if (v >= 50) return '#fa8c16';
        if (v >= 25) return '#faad14';
        return '#52c41a';
    };

    item.innerHTML = `
        <div class="sp-thread-header">
            <span class="sp-thread-status-badge ${statusClass}">${thread.status || '萌芽'}</span>
            <span class="sp-thread-category-badge" style="font-size:0.7em; padding:1px 5px; border-radius:3px; background:rgba(var(--SmartThemeBorderColor-rgb,128,128,128),0.15); flex-shrink:0;">${escapeHtml(categoryStr)}</span>
            <span class="sp-thread-title" contenteditable="true" spellcheck="false">${escapeHtml(thread.title || '')}</span>
            <span class="sp-thread-scale-badge ${scaleClass}">${thread.scale || '微观'}</span>
            
            <div class="sp-tension-pill" title="冲突张力值: ${tensionVal}%" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75em; margin-left:4px; flex-shrink:0;">
                <div style="width:36px; height:6px; background:rgba(var(--SmartThemeBorderColor-rgb,128,128,128),0.2); border-radius:3px; overflow:hidden;">
                    <div class="sp-tension-fill" style="width:${tensionVal}%; height:100%; background:${getTensionColor(tensionVal)}; transition:width 0.3s;"></div>
                </div>
                <span class="sp-tension-num" style="font-size:0.8em; opacity:0.8; width:22px;">${tensionVal}%</span>
            </div>

            <div style="flex:1;"></div>
            <button class="sp-icon-btn sp-inject-btn ${thread.is_injected ? 'active' : ''}" title="${thread.is_injected ? '已开启主楼注入（点击取消）' : '点击开启主楼注入'}">
                <i class="fa-solid fa-bolt"></i>
            </button>
            <button class="sp-icon-btn sp-thread-advance-btn" title="AI 推进此脉络">
                <i class="fa-solid fa-forward-step"></i>
            </button>
            <button class="sp-icon-btn sp-thread-delete-btn" title="删除" style="color:var(--SmartThemeQuoteColor);">
                <i class="fa-solid fa-trash"></i>
            </button>
            <i class="fa-solid fa-chevron-down sp-thread-chevron"></i>
        </div>
        <div class="sp-thread-body" style="display:none;">
            <div class="sp-thread-field-row">
                <label class="sp-field-label">类别</label>
                <select class="plot-select sp-thread-cat-sel" style="font-size:0.85em;padding:3px 6px;">
                    ${['主线', '支线', '情感线', '阵营线'].map(c => `<option value="${c}" ${c === categoryStr ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <label class="sp-field-label" style="margin-left:8px;">叙事尺度</label>
                <select class="plot-select sp-thread-scale-sel" style="font-size:0.85em;padding:3px 6px;">
                    ${THREAD_SCALES.map(s => `<option value="${s}" ${s === thread.scale ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <label class="sp-field-label" style="margin-left:8px;">阶段</label>
                <select class="plot-select sp-thread-status-sel" style="font-size:0.85em;padding:3px 6px;">
                    ${THREAD_STATUSES.map(s => `<option value="${s}" ${s === thread.status ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>

            <div class="sp-thread-field-row" style="align-items:center;">
                <label class="sp-field-label">张力值</label>
                <input type="range" class="sp-thread-tension-range" min="0" max="100" value="${tensionVal}" style="flex:1; margin:0 8px; cursor:pointer;">
                <span class="sp-thread-tension-val" style="font-size:0.85em; font-weight:bold; width:30px;">${tensionVal}%</span>
            </div>

            <div class="sp-thread-field-row">
                <label class="sp-field-label">关联角色</label>
                <input type="text" class="plot-input sp-thread-chars" value="${escapeHtml((thread.characters || []).join('、'))}" placeholder="用、分隔" style="flex:1;font-size:0.85em;padding:4px 8px;">
            </div>
            <div class="sp-thread-field-col">
                <label class="sp-field-label">当前进展</label>
                <textarea class="plot-input sp-thread-desc" rows="3" spellcheck="false" style="font-size:0.85em;resize:vertical;">${escapeHtml(thread.desc || '')}</textarea>
            </div>
            <div class="sp-thread-field-col">
                <label class="sp-field-label">下一个契机</label>
                <textarea class="plot-input sp-thread-next" rows="2" spellcheck="false" style="font-size:0.85em;resize:vertical;">${escapeHtml(thread.next_beat || '')}</textarea>
            </div>
        </div>
    `;

    // Toggle expand
    item.querySelector('.sp-thread-header').addEventListener('click', (e) => {
        if (e.target.closest('.sp-icon-btn') || e.target.closest('[contenteditable]') || e.target.closest('.sp-tension-pill')) return;
        const body    = item.querySelector('.sp-thread-body');
        const chevron = item.querySelector('.sp-thread-chevron');
        const open    = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        chevron.className  = open ? 'fa-solid fa-chevron-down sp-thread-chevron' : 'fa-solid fa-chevron-up sp-thread-chevron';
    });

    // Handle tension slider live update
    const tensionRange = item.querySelector('.sp-thread-tension-range');
    const tensionValSpan = item.querySelector('.sp-thread-tension-val');
    const tensionFill = item.querySelector('.sp-tension-fill');
    const tensionNum = item.querySelector('.sp-tension-num');

    tensionRange.addEventListener('input', () => {
        const val = parseInt(tensionRange.value, 10);
        tensionValSpan.textContent = `${val}%`;
        tensionNum.textContent = `${val}%`;
        tensionFill.style.width = `${val}%`;
        const col = getTensionColor(val);
        tensionFill.style.background = col;
    });

    // Auto-save on field change
    const saveThread = debounce(async () => {
        const threads = pane._threadsData?.threads || [];
        const t = threads.find(t => t.id === thread.id);
        if (!t) return;
        t.title      = item.querySelector('.sp-thread-title')?.textContent || '';
        t.category   = item.querySelector('.sp-thread-cat-sel')?.value || '主线';
        t.scale      = item.querySelector('.sp-thread-scale-sel')?.value   || '微观';
        t.status     = item.querySelector('.sp-thread-status-sel')?.value  || '萌芽';
        t.tension    = parseInt(item.querySelector('.sp-thread-tension-range')?.value, 10) || 0;
        t.desc       = item.querySelector('.sp-thread-desc')?.value        || '';
        t.next_beat  = item.querySelector('.sp-thread-next')?.value        || '';
        const charsRaw = item.querySelector('.sp-thread-chars')?.value     || '';
        t.characters = charsRaw.split(/[、,，]/).map(s => s.trim()).filter(Boolean);

        // Update badges
        const catBadge = item.querySelector('.sp-thread-category-badge');
        if (catBadge) catBadge.textContent = t.category;

        const statusBadge = item.querySelector('.sp-thread-status-badge');
        if (statusBadge) {
            statusBadge.textContent = t.status;
            statusBadge.className = `sp-thread-status-badge sp-status-${t.status}`;
        }
        const scaleBadge = item.querySelector('.sp-thread-scale-badge');
        if (scaleBadge) {
            scaleBadge.textContent = t.scale;
            scaleBadge.className = `sp-thread-scale-badge sp-scale-${t.scale}`;
        }

        await saveData('threads', pane._threadsData);
    }, 600);

    item.querySelectorAll('input, textarea, select, [contenteditable]').forEach(el =>
        el.addEventListener('input', saveThread)
    );
    item.querySelectorAll('select').forEach(el =>
        el.addEventListener('change', saveThread)
    );

    // Single-action per-thread injection trigger
    const threadInjectBtn = item.querySelector('.sp-inject-btn');
    threadInjectBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        threadInjectBtn.classList.add('active');
        setTimeout(() => threadInjectBtn.classList.remove('active'), 350);

        injectSingleItemToChatInput(thread, 'thread');
    });

    // AI Advance button
    item.querySelector('.sp-thread-advance-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await advanceThread(thread, item, pane);
    });

    // Delete button (No prompt dialog)
    item.querySelector('.sp-thread-delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const threads = pane._threadsData?.threads || [];
        pane._threadsData.threads = threads.filter(t => t.id !== thread.id);
        await saveData('threads', pane._threadsData);
        renderThreadsList(pane._threadsData.threads, pane);
    });

    return item;
}

async function advanceThread(thread, item, pane) {
    const btn = item.querySelector('.sp-thread-advance-btn');
    setButtonLoading(btn, true);

    try {
        const mode      = await getActiveModeConfig('storyplan');
        const reading   = mode.useCustomReading ? (mode.reading || {}) : {};
        const ctx       = await buildContext(reading);
        const charName  = getContext().name2 || '角色';
        const userName  = getContext().name1 || '用户';
        const chatHist  = ctx.chat_history || '';

        const messages = [
            {
                role: 'system',
                content: `你是一位叙事推进引擎。根据当前剧情，推进指定故事线的状态。
请返回 JSON：
{
  "new_status": "萌芽|发酵|逼近|已爆发",
  "new_desc": "更新后的当前进展（2-3句）",
  "new_next_beat": "更新后的下一个关键节拍"
}`
            },
            {
                role: 'user',
                content: `【近期对话】\n${chatHist}\n\n【待推进的故事线】
名称：${thread.title}
叙事尺度：${thread.scale}
当前状态：${thread.status}
当前进展：${thread.desc}
下一节拍预测：${thread.next_beat}

请根据对话内容推进该故事线的状态与进展。`
            }
        ];

        const response = await callAIWithSettings(messages, MODULE_IDS.threads);
        if (!response || !response.trim()) {
            throw new Error('AI 未返回任何文本，请检查 API 连接是否畅通');
        }
        const result = parseJsonResponse(response);

        // Update thread data
        const threads = pane._threadsData?.threads || [];
        const t = threads.find(t => t.id === thread.id);
        if (t) {
            t.status    = result.new_status   || t.status;
            t.desc      = result.new_desc      || t.desc;
            t.next_beat = result.new_next_beat || t.next_beat;
            await saveData('threads', pane._threadsData);
        }

        // Update UI fields
        const statusSel = item.querySelector('.sp-thread-status-sel');
        const descTa    = item.querySelector('.sp-thread-desc');
        const nextTa    = item.querySelector('.sp-thread-next');
        if (statusSel) statusSel.value = result.new_status   || thread.status;
        if (descTa)    descTa.value    = result.new_desc      || thread.desc;
        if (nextTa)    nextTa.value    = result.new_next_beat || thread.next_beat;

        const statusBadge = item.querySelector('.sp-thread-status-badge');
        if (statusBadge) {
            statusBadge.textContent = result.new_status || thread.status;
            statusBadge.className   = `sp-thread-status-badge sp-status-${result.new_status || thread.status}`;
        }

        // Open body if it was closed
        const body    = item.querySelector('.sp-thread-body');
        const chevron = item.querySelector('.sp-thread-chevron');
        if (body.style.display === 'none') {
            body.style.display = 'block';
            chevron.className  = 'fa-solid fa-chevron-up sp-thread-chevron';
        }

    } catch (err) {
        console.error('[SP Threads] Advance failed:', err);
    } finally {
        setButtonLoading(btn, false);
    }
}

// ── 蓝图 module ───────────────────────────────────────────────────────────────

async function initOutlinePane(pane) {
    const saved = await loadData('outline');
    if (saved) {
        pane._outlineData = saved;
        renderOutlineData(saved, pane);
    }

    pane.querySelector('#sp-outline-generate-btn')?.addEventListener('click', () => generateOutline(pane));
    pane.querySelector('#sp-outline-clear-btn')?.addEventListener('click', async () => {
        pane._outlineData = null;
        await saveData('outline', null);
        pane.querySelector('#sp-outline-area').innerHTML = `
            <div class="sp-empty-hint" id="sp-outline-empty">
                <i class="fa-solid fa-earth-americas" style="font-size:2em;opacity:0.3;"></i>
                <p>点击"AI 生成世界"，获得约 8 个关键节点的全景分析</p>
            </div>`;
    });
}

async function generateOutline(pane) {
    if (_generating.outline) return;
    _generating.outline = true;

    const btn  = pane.querySelector('#sp-outline-generate-btn');
    const area = pane.querySelector('#sp-outline-area');
    setButtonLoading(btn, true);
    area.innerHTML = `<div class="sp-streaming-hint"><i class="fa-solid fa-circle-notch fa-spin"></i> AI 正在构建剧情蓝图...</div>`;

    try {
        const messages = await buildPromptMessages(MODULE_IDS.outline);
        const response = await callAIWithSettings(messages, MODULE_IDS.outline);
        const data     = parseJsonResponse(response);

        pane._outlineData = data;
        await saveData('outline', data);
        renderOutlineData(data, pane);
    } catch (err) {
        console.error('[SP Outline] Generate failed:', err);
        area.innerHTML = `<div class="sp-error-hint"><i class="fa-solid fa-triangle-exclamation"></i> 生成失败：${escapeHtml(err.message)}</div>`;
    } finally {
        _generating.outline = false;
        setButtonLoading(btn, false);
    }
}

function renderOutlineData(data, pane) {
    const area = pane.querySelector('#sp-outline-area');
    if (!area) return;
    area.innerHTML = '';

    // Analysis block
    if (data.analysis) {
        const analysisEl = document.createElement('div');
        analysisEl.className = 'sp-analysis-block';
        analysisEl.innerHTML = `
            <div class="sp-analysis-header" id="sp-analysis-toggle">
                故事基础分析
                <i class="fa-solid fa-chevron-down sp-analysis-chevron" style="margin-left:auto;"></i>
            </div>
            <div class="sp-analysis-body" style="display:none;">
                ${renderAnalysisFields(data.analysis)}
            </div>
        `;
        analysisEl.querySelector('#sp-analysis-toggle').addEventListener('click', () => {
            const body    = analysisEl.querySelector('.sp-analysis-body');
            const chevron = analysisEl.querySelector('.sp-analysis-chevron');
            const open    = body.style.display !== 'none';
            body.style.display = open ? 'none' : 'block';
            chevron.className  = open ? 'fa-solid fa-chevron-down sp-analysis-chevron' : 'fa-solid fa-chevron-up sp-analysis-chevron';
        });
        area.appendChild(analysisEl);
    }

    // Node cards
    const nodes = data.nodes || [];
    nodes.forEach((node, idx) => {
        const nodeEl = createOutlineNode(node, idx, pane, data);
        area.appendChild(nodeEl);
    });

    if (nodes.length === 0) {
        area.insertAdjacentHTML('beforeend', `<div class="sp-empty-hint"><p>未生成节点</p></div>`);
    }

    applyLockState(pane);
}

function renderAnalysisFields(analysis) {
    const fields = [
        { key: 'current_state',    label: '当前状态' },
        { key: 'main_roles',       label: '角色主次' },
        { key: 'emotion_seeds',    label: '情感萌点' },
        { key: 'plot_pattern',     label: '剧情模式' },
        { key: 'thread_summary',   label: '故事线汇总' },
        { key: 'behavior_patterns', label: '行为模式' },
    ];
    return fields.map(f => `
        <div class="sp-analysis-field">
            <span class="sp-analysis-field-label">${f.label}</span>
            <span class="sp-analysis-field-value">${escapeHtml(analysis[f.key] || '—')}</span>
        </div>
    `).join('');
}

function createOutlineNode(node, idx, pane, allOutlineData) {
    const nodeEl = document.createElement('div');
    nodeEl.className = `sp-outline-node`;

    const layers = [
        { key: 'beat',    label: '事件发生',  hint: '' },
        { key: 'scene',   label: '画面描写',  hint: '' },
        { key: 'subtext', label: '未明之意',  hint: '' },
        { key: 'think',   label: '叙事推进',  hint: '' },
    ];

    const branchesStr = Array.isArray(node.branches) ? node.branches.join('\n') : (node.branches || '');

    nodeEl.innerHTML = `
        <div class="sp-node-header">
            <span class="sp-node-index">${(node.index || idx + 1)}</span>
            <span class="sp-node-beat-preview">${escapeHtml(node.beat || '未命名节点')}</span>
            
            <div style="flex:1;"></div>
            <button class="sp-icon-btn sp-inject-btn ${node.is_injected ? 'active' : ''}" title="${node.is_injected ? '已开启主楼注入（点击取消）' : '点击开启主楼注入'}">
                <i class="fa-solid fa-bolt"></i>
            </button>
            <i class="fa-solid fa-chevron-down sp-node-chevron"></i>
        </div>
        <div class="sp-node-layers" style="display:none;">
            ${layers.map(l => `
                <div class="sp-node-layer">
                    <div class="sp-layer-label">
                        ${l.label}
                        ${l.hint ? `<span class="sp-layer-hint">${l.hint}</span>` : ''}
                    </div>
                    <div class="sp-layer-content" contenteditable="true" spellcheck="false" data-field="${l.key}">${escapeHtml(node[l.key] || '')}</div>
                </div>
            `).join('')}
            
            <div class="sp-node-layer" style="border-top:1px dashed var(--SmartThemeBorderColor); padding-top:6px; margin-top:6px;">
                <div class="sp-layer-label" style="color:var(--SmartThemeEmColor);">
                    抉择分支点 (Branch Choices)
                </div>
                <textarea class="plot-input sp-node-branches-input" rows="2" placeholder="每行一个抉择分支，例如：&#10;分支A: 坦白真相&#10;分支B: 隐瞒并独查" style="font-size:0.85em; resize:vertical;">${escapeHtml(branchesStr)}</textarea>
            </div>
        </div>
    `;

    nodeEl.querySelector('.sp-node-header').addEventListener('click', (e) => {
        if (e.target.closest('.sp-icon-btn') || e.target.closest('[contenteditable]')) return;
        const layersEl = nodeEl.querySelector('.sp-node-layers');
        const chevron  = nodeEl.querySelector('.sp-node-chevron');
        const open     = layersEl.style.display !== 'none';
        layersEl.style.display = open ? 'none' : 'block';
        chevron.className      = open ? 'fa-solid fa-chevron-down sp-node-chevron' : 'fa-solid fa-chevron-up sp-node-chevron';
    });

    // Single-action per-node injection trigger
    const nodeInjectBtn = nodeEl.querySelector('.sp-inject-btn');
    nodeInjectBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        nodeInjectBtn.classList.add('active');
        setTimeout(() => nodeInjectBtn.classList.remove('active'), 350);

        injectSingleItemToChatInput(node, 'node');
    });

    // Save field edits
    const saveOutline = debounce(async () => {
        layers.forEach(l => {
            const el = nodeEl.querySelector(`[data-field="${l.key}"]`);
            if (el) node[l.key] = el.textContent || '';
        });
        const bInput = nodeEl.querySelector('.sp-node-branches-input');
        if (bInput) {
            node.branches = bInput.value.split('\n').map(s => s.trim()).filter(Boolean);
        }
        pane._outlineData = allOutlineData;
        await saveData('outline', allOutlineData);
    }, 600);

    nodeEl.querySelectorAll('[contenteditable], textarea').forEach(el => el.addEventListener('input', saveOutline));

    return nodeEl;
}

// ── Sub-tab switching ─────────────────────────────────────────────────────────

function switchSPTab(tabId, pane) {
    _activeTab = tabId;
    localStorage.setItem('plot_sp_active_tab', tabId);

    pane.querySelectorAll('.sp-sub-tab').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.sptab === tabId)
    );
    pane.querySelectorAll('.sp-pane').forEach(p =>
        p.classList.toggle('active', p.id === `sp-pane-${tabId}`)
    );
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function renderStoryPlanTab(containerEl) {
    _pane = containerEl;

    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/tab-storyplan');
    containerEl.innerHTML = html;

    // Ensure settings have SP preset structures
    ensureSPPresets();

    // Initialize module config drawer (slide-up drawer)
    _drawerController = createModuleConfigDrawer('storyplan', containerEl);

    const cfgBtn = containerEl.querySelector('#sp-cfg-toggle-btn');
    if (cfgBtn) {
        cfgBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            _drawerController?.show();
        });
    }

    // Chat Input Injector Button Handler
    const chatInjectBtn = containerEl.querySelector('#sp-chat-inject-btn');
    if (chatInjectBtn) {
        chatInjectBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const success = await injectToChatInput();
            if (window.toastr) {
                if (success) {
                    window.toastr.success('已同步选定指引到输入框 <request:...> ⚡');
                } else {
                    window.toastr.warning('未能找到输入框 #send_textarea');
                }
            }
        });

        // Right click (contextmenu) to clear all active injections
        chatInjectBtn.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await clearAllInjections();
            renderStoryPlanTab(containerEl);
            if (window.toastr) {
                window.toastr.info('已清空所有已选注入项 🧹');
            }
        });
    }

    // Edit Lock Toggle Handler
    const lockBtn = containerEl.querySelector('#sp-lock-toggle-btn');
    if (lockBtn) {
        lockBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            _isLocked = !_isLocked;
            localStorage.setItem('plot_sp_locked', _isLocked ? 'true' : 'false');
            applyLockState(containerEl);
            if (window.toastr) {
                window.toastr.info(_isLocked ? '卡片编辑已锁定 🔒' : '卡片编辑已解锁 🔓');
            }
        });
    }

    // Main Chat Injection Toggle Handler
    const injectBtn = containerEl.querySelector('#sp-inject-toggle-btn');
    if (injectBtn) {
        const settings = getInjectionSettings();
        const updateInjectBtnUI = () => {
            const active = !!settings.injectStoryPlanToMainChat;
            injectBtn.classList.toggle('active', active);
            injectBtn.style.opacity = active ? '1' : '0.5';
        };
        updateInjectBtnUI();

        injectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            settings.injectStoryPlanToMainChat = !settings.injectStoryPlanToMainChat;
            getContext()?.saveSettingsDebounced?.();
            updateInjectBtnUI();
        });
    }

    // Sub-tab click handlers
    containerEl.querySelectorAll('.sp-sub-tab').forEach(btn => {
        btn.addEventListener('click', () => switchSPTab(btn.dataset.sptab, containerEl));
    });

    // Restore active sub-tab
    switchSPTab(_activeTab, containerEl);

    // Init all panes (async, lazy)
    const eventsPane  = containerEl.querySelector('#sp-pane-events');
    const threadsPane = containerEl.querySelector('#sp-pane-threads');
    const outlinePane = containerEl.querySelector('#sp-pane-outline');

    // Init events pane immediately (it's default visible)
    await initEventsPane(eventsPane);
    await initThreadsPane(threadsPane);
    await initOutlinePane(outlinePane);

    // Restore perspective buttons
    containerEl.querySelectorAll('.sp-persp-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.persp === _perspective)
    );

    // Apply initial lock state across all elements
    applyLockState(containerEl);
}

/**
 * Reload active panes from DB on Chat / Character switch
 */
export async function reloadStoryPlanPanes() {
    if (!_pane) return;
    const eventsPane  = _pane.querySelector('#sp-pane-events');
    const threadsPane = _pane.querySelector('#sp-pane-threads');
    const outlinePane = _pane.querySelector('#sp-pane-outline');

    if (eventsPane) {
        const saved = await loadData('events');
        _pane._eventsData = saved;
        renderEventsData(saved || {}, _pane);
    }
    if (threadsPane) {
        const saved = await loadData('threads');
        _pane._threadsData = saved;
        renderThreadsList(saved?.threads || [], _pane);
    }
    if (outlinePane) {
        const saved = await loadData('outline');
        _pane._outlineData = saved;
        renderOutlineData(saved || {}, _pane);
    }
}

// ── Preset initialization ─────────────────────────────────────────────────────

function ensureSPPresets() {
    const s = extension_settings.plot;
    if (!s) return;

    const SP_MODULES = Object.values(MODULE_IDS);
    if (!s.presets) s.presets = {};
    if (!s.currentPreset) s.currentPreset = {};
    if (!s.streamModules) s.streamModules = {};

    SP_MODULES.forEach(moduleId => {
        if (!s.presets[moduleId]) s.presets[moduleId] = { default: { name: '默认预设', promptBlocks: {} } };
        if (!s.currentPreset[moduleId]) s.currentPreset[moduleId] = 'default';
        if (s.streamModules[moduleId] === undefined) s.streamModules[moduleId] = true;
    });

    getContext()?.saveSettingsDebounced?.();
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function setButtonLoading(btn, loading) {
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (loading) {
        btn.disabled = true;
        if (icon) { icon._origClass = icon.className; icon.className = 'fa-solid fa-circle-notch fa-spin'; }
    } else {
        btn.disabled = false;
        if (icon && icon._origClass) { icon.className = icon._origClass; }
    }
}
