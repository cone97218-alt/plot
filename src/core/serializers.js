/**
 * serializers.js - Shared state serialisation helpers
 *
 * Converts the three main data stores (variables, goals, storylines) to
 * human-readable strings for prompt injection and macro substitution.
 *
 * Two formats per domain:
 *   - Inline  (compact, for {{plot_state}} macro and injection blocks)
 *   - Block   (multiline list, for {{variables_list}} / {{goals_list}} / {{storyline_status}} in prompts)
 *
 * Both prompt-builder.js and injection.js import from here instead of
 * maintaining separate copies.
 */

import { get } from './store.js';

// ── Variables ──────────────────────────────────────────────────────────────────

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
        const val = typeof v === 'object' ? (v.value ?? JSON.stringify(v)) : v;
        return `${k}: ${val}`;
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
            const val = typeof v === 'object' ? JSON.stringify(v.value ?? v) : v;
            return `- ${k}: ${val}`;
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
function hasActiveDescendants(goalId, goalsMap) {
    const goal = goalsMap[goalId];
    if (!goal) return false;
    if (goal.status === 'active' || !goal.status) return true;
    
    const children = Object.values(goalsMap).filter(g => g.parentId === goalId);
    return children.some(child => hasActiveDescendants(child.id, goalsMap));
}

function renderGoalTree(goalId, goalsMap, depth = 0) {
    const goal = goalsMap[goalId];
    if (!goal) return '';
    
    const isActive = goal.status === 'active' || !goal.status;
    const hasActiveChild = Object.values(goalsMap)
        .filter(g => g.parentId === goalId)
        .some(child => hasActiveDescendants(child.id, goalsMap));
        
    if (!isActive && !hasActiveChild) return '';
    
    const indent = '  '.repeat(depth);
    const statusStr = goal.status || 'active';
    const statusLabel = statusStr === 'active' ? '进行中' : (statusStr === 'complete' ? '已完成' : '已失败');
    const line = `${indent}- [${goal.id}] ${goal.title} (状态: ${statusLabel})`;
    
    const children = Object.values(goalsMap)
        .filter(g => g.parentId === goalId)
        .sort((a, b) => a.title.localeCompare(b.title));
        
    const childLines = children
        .map(child => renderGoalTree(child.id, goalsMap, depth + 1))
        .filter(Boolean);
        
    if (childLines.length > 0) {
        return [line, ...childLines].join('\n');
    }
    return line;
}

export function serializeGoals() {
    const goals = get('goals') || {};
    if (Object.keys(goals).length === 0) return '（无目标）';
    
    // Find all root goals (parentId is null or parentId doesn't exist in goals)
    const roots = Object.values(goals).filter(g => !g.parentId || !goals[g.parentId]);
    
    const treeLines = roots
        .map(root => renderGoalTree(root.id, goals))
        .filter(Boolean);
        
    if (treeLines.length === 0) return '（无活动目标）';
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
