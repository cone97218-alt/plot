/**
 * variable-engine.js - Variable/World State System
 * Variable types: number / boolean / text / enum
 * Supports: manual edit, auto-parse (Path C)
 * Triggers: condition met → unlock goal / inject extra prompt text / set variables
 */

import { get, set, subscribe } from './store.js';
import { savePlotData } from './storage.js';
import { setGoalStatus } from './goal-engine.js';

// Execution lock to prevent re-entrant calls via the store subscriber
let _isEvaluatingTriggers = false;

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
        console.warn(`[Plot VariableEngine] Failed to evaluate expression "${expr}":`, err);
        return false;
    }
}

/**
 * Execute actions triggered by condition matches
 * @param {Array} actions
 */
function executeTriggerActions(actions) {
    if (!actions || !Array.isArray(actions) || actions.length === 0) return;

    actions.forEach(action => {
        try {
            if (action.type === 'unlock_goal') {
                const target = action.target;
                if (target) {
                    setGoalStatus(target, 'active');
                }
            } else if (action.type === 'complete_goal') {
                const target = action.target;
                if (target) {
                    setGoalStatus(target, 'complete');
                }
            } else if (action.type === 'fail_goal') {
                const target = action.target;
                if (target) {
                    setGoalStatus(target, 'failed');
                }
            } else if (action.type === 'set_variable') {
                const target = action.target;
                if (target) {
                    const vars = { ...(get('variables') || {}) };
                    if (vars[target] !== undefined) {
                        const val = isNaN(Number(action.value)) ? action.value : Number(action.value);
                        if (typeof vars[target] === 'object' && vars[target] !== null) {
                            vars[target] = { ...vars[target], value: val };
                        } else {
                            vars[target] = val;
                        }
                        set('variables', vars);
                        // Storage will be saved at the end of evaluateTriggers or store update
                    }
                }
            }
        } catch (e) {
            console.error('[Plot VariableEngine] Failed to execute trigger action:', action, e);
        }
    });
}

// ── Core API ──────────────────────────────────────────────────────────────────

export function getVariable(id) {
    const vars = get('variables') || {};
    return vars[id] || null;
}

export function setVariable(id, value) {
    const vars = { ...(get('variables') || {}) };
    const entry = vars[id];
    if (!entry) return false;

    let newVal = value;
    if (typeof entry === 'object' && entry !== null) {
        if (entry.type === 'number') {
            newVal = Number(value);
            if (isNaN(newVal)) newVal = entry.defaultValue || 0;
            if (entry.min !== undefined) newVal = Math.max(entry.min, newVal);
            if (entry.max !== undefined) newVal = Math.min(entry.max, newVal);
        } else if (entry.type === 'boolean') {
            newVal = (value === 'true' || value === true);
        } else if (entry.type === 'json') {
            if (typeof value === 'string') {
                try {
                    newVal = JSON.parse(value);
                } catch (e) {
                    console.warn(`[Plot VariableEngine] Failed to parse JSON value for setVariable: "${value}"`, e);
                    return false;
                }
            }
        }
        vars[id] = { ...entry, value: newVal };
    } else {
        vars[id] = newVal;
    }

    set('variables', vars);
    savePlotData();
    return true;
}

export function createVariable(config) {
    const vars = { ...(get('variables') || {}) };
    const id = config.id;
    if (!id) return null;

    let value = config.value;
    let defaultValue = config.defaultValue;

    if (config.type === 'json') {
        if (typeof value === 'string' && value.trim() !== '') {
            try { value = JSON.parse(value); } catch (e) { value = {}; }
        } else if (value === undefined || value === null) {
            value = {};
        }
        if (typeof defaultValue === 'string' && defaultValue.trim() !== '') {
            try { defaultValue = JSON.parse(defaultValue); } catch (e) { defaultValue = {}; }
        } else if (defaultValue === undefined || defaultValue === null) {
            defaultValue = {};
        }
    }

    vars[id] = {
        id,
        name: config.name || id,
        type: config.type || 'number',
        value: value !== undefined ? value : (defaultValue !== undefined ? defaultValue : (config.type === 'json' ? {} : 0)),
        defaultValue: defaultValue !== undefined ? defaultValue : (config.type === 'json' ? {} : 0),
        min: config.min !== undefined ? Number(config.min) : undefined,
        max: config.max !== undefined ? Number(config.max) : undefined,
        choices: Array.isArray(config.choices) ? config.choices : [],
        description: config.description || '',
        triggers: Array.isArray(config.triggers) ? config.triggers : []
    };

    set('variables', vars);
    savePlotData();

    // Trigger evaluation on next tick
    setTimeout(evaluateTriggers, 10);
    return id;
}

export function deleteVariable(id) {
    const vars = { ...(get('variables') || {}) };
    if (!vars[id]) return false;

    delete vars[id];
    set('variables', vars);
    savePlotData();
    return true;
}

export function listVariables() {
    const vars = get('variables') || {};
    return Object.values(vars);
}

/**
 * Evaluates triggers across all variables.
 */
export function evaluateTriggers() {
    if (_isEvaluatingTriggers) return;
    _isEvaluatingTriggers = true;

    try {
        const vars = { ...(get('variables') || {}) };
        const context = {};
        for (const [name, entry] of Object.entries(vars)) {
            context[name] = (typeof entry === 'object' && entry !== null && 'value' in entry)
                ? entry.value
                : entry;
        }

        let storeChanged = false;

        for (const [id, entry] of Object.entries(vars)) {
            if (typeof entry !== 'object' || entry === null || !Array.isArray(entry.triggers)) {
                continue;
            }

            const currentValue = entry.value;
            const evalContext = { ...context, value: currentValue };

            entry.triggers.forEach(trigger => {
                if (!trigger.condition) return;

                const isMet = evalExpression(trigger.condition, evalContext);

                if (trigger.type === 'once') {
                    if (isMet && !trigger.fired) {
                        trigger.fired = true;
                        storeChanged = true;
                        console.log(`[Plot VariableEngine] Variable "${id}" trigger once condition met: ${trigger.condition}`);
                        if (typeof toastr !== 'undefined') {
                            toastr.success(`变量触发器满足：${entry.name || id} (${trigger.condition})`);
                        }
                        executeTriggerActions(trigger.actions);
                    }
                } else {
                    // persistent trigger
                    const wasActive = !!trigger.active;
                    if (isMet !== wasActive) {
                        trigger.active = isMet;
                        storeChanged = true;

                        if (isMet) {
                            console.log(`[Plot VariableEngine] Variable "${id}" trigger persistent active: ${trigger.condition}`);
                            if (typeof toastr !== 'undefined') {
                                toastr.success(`变量触发器生效：${entry.name || id} (${trigger.condition})`);
                            }
                            executeTriggerActions(trigger.actions);
                        } else {
                            console.log(`[Plot VariableEngine] Variable "${id}" trigger persistent inactive: ${trigger.condition}`);
                        }
                    }
                }
            });
        }

        if (storeChanged) {
            set('variables', vars);
            savePlotData();
        }
    } finally {
        _isEvaluatingTriggers = false;
    }
}

/**
 * Retrieve active prompt injections from variables of a specific mode.
 * @param {string} mode - 'system' | 'variable'
 * @returns {Array<string>}
 */
export function getActivePromptInjections(mode = 'system') {
    const vars = get('variables') || {};
    const injections = [];

    for (const [id, entry] of Object.entries(vars)) {
        if (typeof entry !== 'object' || entry === null || !Array.isArray(entry.triggers)) {
            continue;
        }

        entry.triggers.forEach(trigger => {
            const isActive = trigger.type === 'once' ? !!trigger.fired : !!trigger.active;
            if (isActive && Array.isArray(trigger.actions)) {
                trigger.actions.forEach(action => {
                    if (action.type === 'inject_prompt' && (action.mode || 'system') === mode && action.content) {
                        injections.push(action.content);
                    }
                });
            }
        });
    }

    return injections;
}

export function serializeForPrompt() {
    // Return empty string here, relying on serializers.js serializeVariables()
    return '';
}

// Auto-evaluate triggers whenever variables change
subscribe('variables', () => {
    evaluateTriggers();
});
