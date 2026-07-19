/**
 * serializers.js - Shared state serialisation helpers
 *
 * Converts the three main data stores (variables, goals, storylines) to
 * human-readable strings for prompt injection and macro substitution.
 *
 * Formats per domain:
 *   - Inline  (compact, for {{plot_state}} macro and injection blocks)
 *   - Block   (multiline lists, for {{plot_variables}} / {{plot_goals}} / {{plot_storyline}} in prompts)
 *
 * Both prompt-builder.js and injection.js import from here instead of
 * maintaining separate copies.
 */

import { get } from './store.js';

// ── Variables ──────────────────────────────────────────────────────────────────

/**
 * Get active prompt injections for a variable as a suffix.
 */
export function getActiveVariableSuffix(entry) {
    if (typeof entry !== 'object' || entry === null || !Array.isArray(entry.triggers)) {
        return '';
    }
    const suffixes = [];
    entry.triggers.forEach(trigger => {
        const isActive = trigger.type === 'once' ? !!trigger.fired : !!trigger.active;
        if (isActive && Array.isArray(trigger.actions)) {
            trigger.actions.forEach(action => {
                if (action.type === 'inject_prompt' && action.mode === 'variable' && action.content) {
                    suffixes.push(action.content);
                }
            });
        }
    });
    return suffixes.length > 0 ? ` (${suffixes.join(', ')})` : '';
}

/**
 * Recursively format a complex JSON value (object or array) into a clean Markdown list.
 * @param {*} val - Value to format
 * @param {number} depth - Indentation depth (0-indexed)
 * @returns {string}
 */
export function formatComplexValue(val, depth = 0) {
    if (val === null || val === undefined) return 'null';
    if (typeof val !== 'object') return String(val);

    const indent = '  '.repeat(depth);

    if (Array.isArray(val)) {
        if (val.length === 0) return '[]';
        return '\n' + val.map((item, idx) => {
            if (typeof item !== 'object' || item === null) {
                return `${indent}  - ${formatComplexValue(item, depth + 1)}`;
            }
            const itemKeys = Object.keys(item);
            const primaryKey = itemKeys.find(k => ['name', 'title', 'id', 'label', '名称', '标题'].includes(k.toLowerCase()));
            const primaryVal = primaryKey ? item[primaryKey] : `项目 ${idx + 1}`;
            
            const otherFields = itemKeys
                .filter(k => k !== primaryKey)
                .map(k => `${k}: ${serializeComplexInline(item[k])}`)
                .join(', ');
            
            const detailStr = otherFields ? ` (${otherFields})` : '';
            return `${indent}  - ${primaryVal}${detailStr}`;
        }).join('\n');
    } else {
        const keys = Object.keys(val);
        if (keys.length === 0) return '{}';
        return '\n' + keys.map(k => {
            const v = val[k];
            if (typeof v === 'object' && v !== null) {
                return `${indent}  * ${k}:${formatComplexValue(v, depth + 1)}`;
            } else {
                return `${indent}  * ${k}: ${formatComplexValue(v, depth + 1)}`;
            }
        }).join('\n');
    }
}

/**
 * Serialize a complex JSON value into a compact inline string format.
 * @param {*} val - Value to format
 * @returns {string}
 */
export function serializeComplexInline(val) {
    if (val === null || val === undefined) return 'null';
    if (typeof val !== 'object') return String(val);

    if (Array.isArray(val)) {
        return '[' + val.map(item => {
            if (typeof item !== 'object' || item === null) return String(item);
            const keys = Object.keys(item);
            const primaryKey = keys.find(k => ['name', 'title', 'id', 'label', '名称', '标题'].includes(k.toLowerCase()));
            if (primaryKey) {
                const countKey = keys.find(k => ['count', 'quantity', 'amount', '数量'].includes(k.toLowerCase()));
                const countStr = countKey ? ` x${item[countKey]}` : '';
                return `${item[primaryKey]}${countStr}`;
            }
            return '{' + keys.map(k => `${k}: ${serializeComplexInline(item[k])}`).join(', ') + '}';
        }).join(', ') + ']';
    } else {
        const keys = Object.keys(val);
        return '{' + keys.map(k => {
            const v = val[k];
            const displayVal = typeof v === 'object' && v !== null ? '...' : String(v);
            return `${k}: ${displayVal}`;
        }).join(', ') + '}';
    }
}

/**
 * Serialise variables to a compact inline string.
 * Example: "关系值: 55, 位置: 咖啡馆"
 * @returns {string}
 */
export function serializeVariablesInline() {
    const vars = get('variables') || {};
    const entries = Object.entries(vars);
    if (entries.length === 0) return '（无）';
    return entries.map(([k, v]) => {
        const displayName = (typeof v === 'object' && v !== null && v.name) ? v.name : k;
        let val = (typeof v === 'object' && v !== null && 'value' in v) ? v.value : v;
        if (typeof v === 'object' && v !== null && v.type === 'json') {
            val = serializeComplexInline(val);
        }
        const suffix = getActiveVariableSuffix(v);
        return `${displayName}: ${val}${suffix}`;
    }).join(', ');
}

/**
 * Serialise variables to a bullet-list string for AI prompts.
 * Example:
 *   - 关系值: 55
 *   - 位置: 咖啡馆
 * @returns {string}
 */
export function serializeVariables() {
    const vars = get('variables') || {};
    if (Object.keys(vars).length === 0) return '（无变量）';
    return Object.entries(vars)
        .map(([k, v]) => {
            const displayName = (typeof v === 'object' && v !== null && v.name) ? v.name : k;
            let val = (typeof v === 'object' && v !== null && 'value' in v) ? v.value : v;
            let valStr = '';
            if (typeof v === 'object' && v !== null && v.type === 'json') {
                valStr = formatComplexValue(val, 0);
            } else {
                valStr = String(val);
            }
            const suffix = getActiveVariableSuffix(v);
            return `- ${displayName}: ${valStr}${suffix}`;
        })
        .join('\n');
}

// ── Goals ──────────────────────────────────────────────────────────────────────

/**
 * Serialise active goals to a compact inline string.
 * Example: "[进行中] 获得信任; [进行中] 完成调查"
 * @returns {string}
 */
export function serializeGoalsInline() {
    const goals = get('goals') || {};
    const active = Object.values(goals).filter(g => g.status === 'active' || !g.status);
    if (active.length === 0) return '（无）';
    return active.map(g => `[进行中] ${g.title}`).join('; ');
}

/**
 * Serialise non-completed goals to a bullet-list string for AI prompts.
 * @returns {string}
 */
function hasDescendantsWithStatus(goalId, goalsMap, statusFilter) {
    const goal = goalsMap[goalId];
    if (!goal) return false;
    
    const goalStatus = goal.status || 'active';
    if (statusFilter === 'all') return true;
    if (goalStatus === statusFilter) return true;
    
    const children = Object.values(goalsMap).filter(g => g.parentId === goalId);
    return children.some(child => hasDescendantsWithStatus(child.id, goalsMap, statusFilter));
}

function renderGoalTree(goalId, goalsMap, statusFilter = 'active', depth = 0) {
    const goal = goalsMap[goalId];
    if (!goal) return '';
    
    const goalStatus = goal.status || 'active';
    const matchesFilter = statusFilter === 'all' || goalStatus === statusFilter;
    const hasMatchingDescendant = Object.values(goalsMap)
        .filter(g => g.parentId === goalId)
        .some(child => hasDescendantsWithStatus(child.id, goalsMap, statusFilter));
        
    if (!matchesFilter && !hasMatchingDescendant) return '';
    
    const indent = '  '.repeat(depth);
    const statusLabel = goalStatus === 'active' ? '进行中' : (goalStatus === 'complete' ? '已完成' : (goalStatus === 'failed' ? '已失败' : '已隐藏'));
    const line = `${indent}- [${goal.id}] ${goal.title} (状态: ${statusLabel})`;
    
    const children = Object.values(goalsMap)
        .filter(g => g.parentId === goalId)
        .sort((a, b) => a.title.localeCompare(b.title));
        
    const childLines = children
        .map(child => renderGoalTree(child.id, goalsMap, statusFilter, depth + 1))
        .filter(Boolean);
        
    if (childLines.length > 0) {
        return [line, ...childLines].join('\n');
    }
    return line;
}

export function serializeGoals(statusFilter = 'active') {
    const goals = get('goals') || {};
    if (Object.keys(goals).length === 0) return '（无目标）';
    
    // Find all root goals (parentId is null or parentId doesn't exist in goals)
    const roots = Object.values(goals).filter(g => !g.parentId || !goals[g.parentId]);
    
    const treeLines = roots
        .map(root => renderGoalTree(root.id, goals, statusFilter))
        .filter(Boolean);
        
    if (treeLines.length === 0) {
        const labelMap = { active: '活动', complete: '已完成', failed: '已失败', hidden: '已隐藏', all: '' };
        return `（无${labelMap[statusFilter] || ''}目标）`;
    }
    return treeLines.join('\n');
}

// ── Storylines ────────────────────────────────────────────────────────────────

/**
 * Serialise storylines to a compact inline string.
 * Example: "主线 | 章节: 第二章; 支线 | 章节: 未开始"
 * @returns {string}
 */
export function serializeStorylinesInline() {
    const storylines = get('storylines') || {};
    const entries = Object.values(storylines);
    if (entries.length === 0) return '（无）';
    return entries.map(s => `${s.title} | 章节: ${s.currentChapter || '未开始'}`).join('; ');
}

/**
 * Serialise storylines to a bullet-list string for AI prompts.
 * @returns {string}
 */
export function serializeStorylines() {
    const storylines = get('storylines') || {};
    if (Object.keys(storylines).length === 0) return '（无故事线）';
    return Object.entries(storylines)
        .map(([id, s]) => `- [${id}] ${s.title} | 当前章节: ${s.currentChapter || '未开始'}`)
        .join('\n');
}
