/**
 * goal-engine.js - Goal/Quest System
 * Hierarchical goal tree: main goal → sub-goals → milestones
 * Statuses: active / complete / failed / hidden
 * Completion: manual / AI auto-detect / variable trigger unlock / keyword match
 * Linked with variable system and triggers actions on transition.
 */

import { get, set, subscribe } from './store.js';
import { savePlotData } from './storage.js';
import { serializeGoals } from './serializers.js';

// B4 Fix: execution lock to prevent re-entrant calls via the store subscriber
let _isEvaluatingVariableGoals = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely evaluates a JS math/logical expression within a variable context.
 * @param {string} expr - Condition string (e.g. "relationship >= 60")
 * @param {Object} context - Map of variable names to primitive values
 * @returns {boolean}
 */
function evalExpression(expr, context) {
    try {
        const keys = Object.keys(context);
        const vals = Object.values(context);
        const fn = new Function(...keys, `return (${expr});`);
        return !!fn(...vals);
    } catch (err) {
        console.warn(`[Plot GoalEngine] Failed to evaluate expression "${expr}":`, err);
        return false;
    }
}

// ── Core API ──────────────────────────────────────────────────────────────────

export function getGoal(id) {
    const goals = get('goals') || {};
    return goals[id] || null;
}

export function listGoals() {
    const goals = get('goals') || {};
    return Object.values(goals);
}

export function createGoal(config) {
    const goals = { ...(get('goals') || {}) };
    let id = config.id;
    if (!id) {
        let maxNum = 0;
        Object.keys(goals).forEach(key => {
            const match = key.match(/^g_(\d+)$/) || key.match(/^goal_(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        id = 'g_' + (maxNum + 1);
    }
    
    goals[id] = {
        id,
        parentId: config.parentId || null,
        title: config.title || '新目标',
        description: config.description || '',
        status: config.status || 'active', // 'active' | 'complete' | 'failed' | 'hidden'
        type: config.type || 'manual', // 'manual' | 'variable' | 'keyword' | 'ai'
        conditions: config.conditions || { variable: '', keywords: [] },
        actions: config.actions || [],
        ...config
    };
    
    set('goals', goals);
    savePlotData();
    return id;
}

export function deleteGoal(id) {
    const goals = { ...(get('goals') || {}) };
    if (!goals[id]) return false;
    
    // Set parentId of children to null (orphan children rather than deleting recursively)
    Object.keys(goals).forEach(k => {
        if (goals[k].parentId === id) {
            goals[k].parentId = null;
        }
    });
    
    delete goals[id];
    set('goals', goals);
    savePlotData();
    return true;
}

export function setGoalStatus(id, status) {
    const goals = { ...(get('goals') || {}) };
    const goal = goals[id];
    if (!goal) return;
    
    const oldStatus = goal.status;
    if (oldStatus === status) return;
    
    goal.status = status;
    set('goals', goals);
    
    // If completed or failed, trigger cascade actions
    if (status === 'complete' || status === 'failed') {
        runActions(goal.actions || []);
    }
    
    savePlotData();
    
    // Dispatch custom update events
    document.dispatchEvent(new CustomEvent('plot:storeUpdated', { 
        detail: { changed: { source: 'goal_status', goalId: id, status } } 
    }));
}

// ── Triggers and Actions Execution ─────────────────────────────────────────────

export function runActions(actions) {
    if (!actions || !Array.isArray(actions) || actions.length === 0) return;
    
    const vars = { ...(get('variables') || {}) };
    const goals = { ...(get('goals') || {}) };
    let varsChanged = false;
    let goalsChanged = false;
    
    actions.forEach(action => {
        if (action.type === 'variable') {
            const target = action.target;
            if (!target || vars[target] === undefined) return;
            
            const varEntry = vars[target];
            const currentVal = (typeof varEntry === 'object' && varEntry !== null) 
                ? (varEntry.value ?? 0) 
                : (varEntry ?? 0);
            
            const val = Number(action.value) || 0;
            let newVal = currentVal;
            
            if (action.op === 'add') {
                newVal = Number(currentVal) + val;
            } else if (action.op === 'sub') {
                newVal = Number(currentVal) - val;
            } else if (action.op === 'set') {
                newVal = isNaN(Number(action.value)) ? action.value : Number(action.value);
            } else if (action.op === 'toggle') {
                newVal = !currentVal;
            }
            
            if (typeof varEntry === 'object' && varEntry !== null) {
                if (varEntry.min !== undefined) newVal = Math.max(varEntry.min, newVal);
                if (varEntry.max !== undefined) newVal = Math.min(varEntry.max, newVal);
                vars[target] = { ...varEntry, value: newVal };
            } else {
                vars[target] = newVal;
            }
            varsChanged = true;
            console.log(`[Plot GoalEngine] Action Var "${target}" ${action.op} ${val} -> ${newVal}`);
            
        } else if (action.type === 'goal') {
            const target = action.target;
            const op = action.op;
            if (!target || !goals[target]) return;
            
            if (op === 'unlock') {
                if (goals[target].status === 'hidden') {
                    goals[target].status = 'active';
                    goalsChanged = true;
                    console.log(`[Plot GoalEngine] Action Goal: unlock "${target}"`);
                }
            } else if (op === 'complete') {
                if (goals[target].status !== 'complete') {
                    goals[target].status = 'complete';
                    goalsChanged = true;
                    console.log(`[Plot GoalEngine] Action Goal: complete "${target}"`);
                    // Defer recursive actions to avoid callstack overflow
                    setTimeout(() => {
                        const targetGoal = getGoal(target);
                        if (targetGoal) runActions(targetGoal.actions || []);
                    }, 0);
                }
            } else if (op === 'failed') {
                if (goals[target].status !== 'failed') {
                    goals[target].status = 'failed';
                    goalsChanged = true;
                    console.log(`[Plot GoalEngine] Action Goal: fail "${target}"`);
                    setTimeout(() => {
                        const targetGoal = getGoal(target);
                        if (targetGoal) runActions(targetGoal.actions || []);
                    }, 0);
                }
            }
            
        } else if (action.type === 'storyline') {
            console.log(`[Plot GoalEngine] Triggered Storyline Action: advance on "${action.target}"`);
            document.dispatchEvent(new CustomEvent('plot:storylineAction', { detail: action }));
        }
    });
    
    if (varsChanged) {
        set('variables', vars);
    }
    if (goalsChanged) {
        set('goals', goals);
    }
    
    if (varsChanged || goalsChanged) {
        savePlotData();
        // If variables changed, evaluate variable triggers again
        if (varsChanged) {
            setTimeout(evaluateVariableGoals, 10);
        }
    }
}

/**
 * Scan all active variable-based goals and resolve if conditions are met.
 */
export function evaluateVariableGoals() {
    // Guard against re-entrant calls triggered by savePlotData -> subscribe -> evaluateVariableGoals
    if (_isEvaluatingVariableGoals) return;
    _isEvaluatingVariableGoals = true;
    try {
    const goals = { ...(get('goals') || {}) };
    const vars = get('variables') || {};
    
    // Construct evaluation context with variable values
    const context = {};
    for (const [name, entry] of Object.entries(vars)) {
        context[name] = (typeof entry === 'object' && entry !== null && 'value' in entry) 
            ? entry.value 
            : entry;
    }
    
    let changed = false;
    const completedGoalActions = [];
    
    Object.values(goals).forEach(goal => {
        if (goal.status === 'active' && goal.type === 'variable' && goal.conditions?.variable) {
            const isMet = evalExpression(goal.conditions.variable, context);
            if (isMet) {
                goal.status = 'complete';
                changed = true;
                completedGoalActions.push(goal.actions || []);
                console.log(`[Plot GoalEngine] Goal "${goal.id}" complete by Variable condition: ${goal.conditions.variable}`);
                
                if (typeof toastr !== 'undefined') {
                    const usedVars = Object.keys(context).filter(k => goal.conditions.variable.includes(k));
                    const ctxDesc = usedVars.map(k => `${k} = ${context[k]}`).join(', ');
                    toastr.success(
                        `完成方式：变量判定\n触发条件：${goal.conditions.variable} (当前: ${ctxDesc})`,
                        `🎉 剧情目标自动达成：【${goal.title}】`,
                        { timeOut: 12000, closeButton: true }
                    );
                }
            }
        }
    });
    
    if (changed) {
        set('goals', goals);
        savePlotData();
        
        // Execute completed goals actions sequentially
        completedGoalActions.forEach(actions => runActions(actions));
        
        document.dispatchEvent(new CustomEvent('plot:storeUpdated', { 
            detail: { changed: { source: 'variable_evaluation' } } 
        }));
    }
    } finally {
        // Always release the lock, even if an error is thrown mid-evaluation
        _isEvaluatingVariableGoals = false;
    }
}

/**
 * Scan all active keyword-based goals and resolve if match found in AI reply message.
 * @param {string} messageText
 */
export function evaluateKeywordGoals(messageText) {
    if (!messageText) return;
    const goals = { ...(get('goals') || {}) };
    let changed = false;
    const completedGoalActions = [];
    
    Object.values(goals).forEach(goal => {
        if (goal.status === 'active' && goal.type === 'keyword' && goal.conditions?.keywords) {
            const keywords = Array.isArray(goal.conditions.keywords)
                ? goal.conditions.keywords
                : (typeof goal.conditions.keywords === 'string' 
                    ? goal.conditions.keywords.split(',').map(k => k.trim()) 
                    : []);
            
            const isMatch = keywords.filter(Boolean).some(kw => messageText.includes(kw));
            if (isMatch) {
                goal.status = 'complete';
                changed = true;
                completedGoalActions.push(goal.actions || []);
                console.log(`[Plot GoalEngine] Goal "${goal.id}" complete by Keyword match: ${keywords}`);
                
                if (typeof toastr !== 'undefined') {
                    const matchedKw = keywords.find(kw => messageText.includes(kw));
                    const startIdx = Math.max(0, messageText.indexOf(matchedKw) - 15);
                    const endIdx = Math.min(messageText.length, messageText.indexOf(matchedKw) + matchedKw.length + 15);
                    const snippet = (startIdx > 0 ? '...' : '') + messageText.substring(startIdx, endIdx) + (endIdx < messageText.length ? '...' : '');
                    toastr.success(
                        `完成方式：关键词判定\n触发词："${matchedKw}"\n上下文："${snippet}"`,
                        `🎉 剧情目标自动达成：【${goal.title}】`,
                        { timeOut: 12000, closeButton: true }
                    );
                }
            }
        }
    });
    
    if (changed) {
        set('goals', goals);
        savePlotData();
        
        completedGoalActions.forEach(actions => runActions(actions));
        
        document.dispatchEvent(new CustomEvent('plot:storeUpdated', { 
            detail: { changed: { source: 'keyword_evaluation' } } 
        }));
    }
}

export function serializeForPrompt() {
    // Rely on centralized serialisation in serializers.js
    return serializeGoals();
}

// Auto-evaluate variable goals whenever variables change
subscribe('variables', () => {
    evaluateVariableGoals();
});
