/**
 * injection.js - State injection pipeline (main chat prompt)
 *
 * Serialises the current active modules' state and appends it to the
 * GENERATE_BEFORE_COMBINE_PROMPTS hook.
 *
 * Two modes (controlled by extension_settings.plot.injectionMode):
 *   'auto'  - Automatically append to the generation context as a system message/user suffix
 *   'macro' - User places {{plot_state}} etc. in their character card / system prompt;
 *             injection.js just supplies the text, macro.js handles substitution.
 */

import { get } from './store.js';
import { extension_settings } from '../../../../../extensions.js';
import { setExtensionPrompt } from '../../../../../../script.js';
import { serializeVariablesInline, serializeGoalsInline, serializeStorylinesInline, serializeComplexInline, formatComplexValue, getActiveVariableSuffix, serializeGoals } from './serializers.js';
import { getActivePromptInjections } from './variable-engine.js';

const MODULE_NAME = 'plot';

// ── Custom Goal Templates & Macro Resolving ────────────────────────────────────

/**
 * Format a single goal line using a custom template.
 * Matches placeholders like {{title}}, {{desc}}, {{status}}, {{type}}
 * or custom extra fields.
 *
 * @param {Object} goal
 * @param {string} defaultLineTemplate
 * @returns {string}
 */
export function formatGoalLine(goal, defaultLineTemplate) {
    const tpl = goal.injectLineTemplate || defaultLineTemplate || "【{{title}}】{{desc}}";
    
    let res = tpl
        .replace(/\{\{title\}\}/g, goal.title || '')
        .replace(/\{\{desc\}\}/g, goal.description || '')
        .replace(/\{\{status\}\}/g, goal.status || 'active')
        .replace(/\{\{type\}\}/g, goal.type || 'manual');
        
    // Custom extra fields
    const extraKeys = Object.keys(goal).filter(k => 
        !['id', 'parentId', 'title', 'description', 'status', 'type', 'conditions', 'actions', 'injectLineTemplate'].includes(k)
    );
    extraKeys.forEach(k => {
        const val = goal[k];
        const placeholder = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
        res = res.replace(placeholder, val !== undefined && val !== null ? String(val) : '');
    });
    
    // Clean up remaining placeholders
    res = res.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
    return res;
}

/**
 * Resolve global template macros:
 * {{plot_goals_active}}, {{plot_goals_complete}}, {{plot_goals_failed}}, {{plot_goals_all}}
 *
 * Pinned active goals are automatically excluded from the general macros and
 * appended under a separate dedicated pinned section at the end of the prompt block.
 *
 * @param {string} template
 * @param {string} defaultLineTemplate
 * @returns {string}
 */
export function resolveGoalMacros(template, defaultLineTemplate) {
    const goals = get('goals') || {};
    const goalList = Object.values(goals);
    const pinnedIds = get('pinnedGoalIds') || [];
    
    const formatList = (list) => list.map(g => formatGoalLine(g, defaultLineTemplate)).filter(Boolean).join('\n');
    
    // Categorize goals
    const activeGoals    = goalList.filter(g => (g.status === 'active' || !g.status) && !pinnedIds.includes(g.id));
    const completeGoals  = goalList.filter(g => g.status === 'complete');
    const failedGoals    = goalList.filter(g => g.status === 'failed');
    const hiddenGoals    = goalList.filter(g => g.status === 'hidden');
    const allGoals       = goalList;
    // Pinned active goals — exposed as {{plot_goals_pinned}}, NOT auto-appended
    const pinnedGoals    = goalList.filter(g => (g.status === 'active' || !g.status) && pinnedIds.includes(g.id));
    
    const res = template
        .replace(/\{\{plot_goals_active\}\}/g,  formatList(activeGoals))
        .replace(/\{\{plot_goals_complete\}\}/g, formatList(completeGoals))
        .replace(/\{\{plot_goals_failed\}\}/g,   formatList(failedGoals))
        .replace(/\{\{plot_goals_hidden\}\}/g,   formatList(hiddenGoals))
        .replace(/\{\{plot_goals_all\}\}/g,      formatList(allGoals))
        .replace(/\{\{plot_goals_pinned\}\}/g,   formatList(pinnedGoals));
        
    return res.trim();
}

// ── Build injection text ───────────────────────────────────────────────────────

/**
 * Build the full injection text block for the active modules.
 * Returns empty string if injection is disabled or all modules are inactive.
 *
 * @returns {string}
 */
// ── Custom Variable Templates & Macro Resolving ────────────────────────────────

/**
 * Format a single variable line using a custom template.
 * Matches placeholders like {{name}}, {{id}}, {{value}}, {{value_tree}}, {{desc}}, {{type}}
 *
 * @param {Object} v
 * @param {string} defaultLineTemplate
 * @returns {string}
 */
export function formatVariableLine(v, defaultLineTemplate) {
    const tpl = defaultLineTemplate || "- {{name}}: {{value}}";
    
    let valStr = '';
    if (v.type === 'json') {
        valStr = serializeComplexInline(v.value);
    } else {
        valStr = String(v.value);
    }
    
    const valueTreeStr = v.type === 'json' ? formatComplexValue(v.value, 1) : String(v.value);

    // Get active suffix (e.g. prompt suffixes from triggers)
    const suffix = getActiveVariableSuffix(v);
    const finalVal = valStr + suffix;

    let res = tpl
        .replace(/\{\{name\}\}/g, v.name || v.id)
        .replace(/\{\{id\}\}/g, v.id)
        .replace(/\{\{value\}\}/g, finalVal)
        .replace(/\{\{value_tree\}\}/g, valueTreeStr)
        .replace(/\{\{desc\}\}/g, v.description || '')
        .replace(/\{\{description\}\}/g, v.description || '')
        .replace(/\{\{type\}\}/g, v.type || 'number');
        
    return res;
}

/**
 * Resolve global variable templates:
 * {{plot_variables_visible}}, {{plot_variables_hidden}}, {{plot_variables_all}}
 *
 * @param {string} template
 * @param {string} defaultLineTemplate
 * @param {boolean} injectAll
 * @returns {string}
 */
export function resolveVariableMacros(template, defaultLineTemplate, injectAll = false) {
    const vars = get('variables') || {};
    const varList = Object.values(vars).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    const formatList = (list) => list.map(v => formatVariableLine(v, defaultLineTemplate)).filter(Boolean).join('\n');
    
    const visibleVars = varList.filter(v => v.visible !== false);
    const hiddenVars  = varList.filter(v => v.visible === false);
    const allVars     = varList;
    
    const res = template
        .replace(/\{\{plot_variables_visible\}\}/g, formatList(visibleVars))
        .replace(/\{\{plot_variables_hidden\}\}/g,  formatList(hiddenVars))
        .replace(/\{\{plot_variables_all\}\}/g,     formatList(allVars));
        
    return res.trim();
}

/**
 * Default global injection template.
 * Placeholders: {{goals}}, {{variables}}, {{storylines}}
 * Lines whose placeholder resolves to empty string are deleted entirely.
 */
const DEFAULT_GLOBAL_TEMPLATE = `[剧情状态]
{{goals}}
[/剧情状态]`;

/**
 * Resolve the variables placeholder for use inside the global template.
 * When variablesInjection is enabled, runs the full block template through resolveVariableMacros.
 * Otherwise falls back to serializeVariablesInline().
 *
 * @param {Object} s - extension_settings[MODULE_NAME]
 * @returns {string}
 */
function resolveVariablesBlock(s) {
    const varInject = s.variablesInjection || {
        enabled: true,
        injectAll: false,
        template: "当前状态:\n{{plot_variables_visible}}",
        lineTemplate: "- {{name}}: {{value}}"
    };
    if (varInject.enabled) {
        return resolveVariableMacros(varInject.template, varInject.lineTemplate, varInject.injectAll);
    }
    return serializeVariablesInline();
}

/**
 * Resolve the goals placeholder for use inside the global template.
 * When goalInjection is enabled, runs the full block template through resolveGoalMacros.
 * Otherwise falls back to serializeGoalsInline().
 *
 * @param {Object} s - extension_settings[MODULE_NAME]
 * @returns {string}
 */
function resolveGoalsBlock(s) {
    const goalInject = s.goalInjection || { enabled: false, template: '当前任务:\n{{plot_goals_active}}', lineTemplate: '【{{title}}】{{desc}}' };
    if (goalInject.enabled) {
        return resolveGoalMacros(goalInject.template, goalInject.lineTemplate);
    }
    return serializeGoalsInline();
}

export function buildInjectionText() {
    const s = extension_settings[MODULE_NAME] || {};
    const modules = s.modules || {};

    // Check if injection is globally enabled
    if (s.injectionEnabled === false) return '';

    // Resolve each module block (empty string when module is off)
    const goalsText     = modules.goals     !== false ? resolveGoalsBlock(s)         : '';
    const varsText      = modules.variables  !== false ? resolveVariablesBlock(s)     : '';
    const storylineText = modules.storyline  !== false ? serializeStorylinesInline()   : '';

    // Nothing to inject
    if (!goalsText && !varsText && !storylineText) return '';

    // Use global template (user-configurable) or fall back to default
    const globalTemplate = (s.globalInjectionTemplate || DEFAULT_GLOBAL_TEMPLATE).trim();

    // Replace placeholders, then delete lines that are entirely empty after substitution
    let result = globalTemplate
        .replace(/\{\{goals\}\}/g,      goalsText)
        .replace(/\{\{variables\}\}/g,   varsText)
        .replace(/\{\{storylines\}\}/g,  storylineText);

    // Remove lines that contain only whitespace (caused by disabled-module placeholders)
    result = result
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n');

    // Retrieve active system-level variable prompt injections
    let varInjections = '';
    if (modules.variables !== false) {
        const injections = getActivePromptInjections('system');
        if (injections.length > 0) {
            varInjections = '\n' + injections.join('\n');
        }
    }

    return result 
        ? `\n\n${result}${varInjections}` 
        : (varInjections ? `\n\n${varInjections.trim()}` : '');
}

/**
 * Expose the current state values for macro substitution.
 * Called by macro.js to resolve {{plot_state}}, {{plot_variables}}, etc.
 *
 * @returns {{ plot_state: string, plot_variables: string, plot_goals: string, plot_storyline: string }}
 */
export function getInjectionMacros() {
    const s = extension_settings[MODULE_NAME] || {};
    const goalInject = s.goalInjection || { enabled: false, template: "当前任务:\n{{plot_goals_active}}", lineTemplate: "【{{title}}】{{desc}}" };
    
    let goalsStr = '';
    if (goalInject.enabled) {
        goalsStr = resolveGoalMacros(goalInject.template, goalInject.lineTemplate);
    } else {
        goalsStr = serializeGoalsInline();
    }

    return {
        plot_state:          buildInjectionText().trim(),
        plot_variables:      resolveVariablesBlock(s),
        plot_goals:          goalsStr,
        plot_storyline:      serializeStorylinesInline(),
        plot_goals_active:   serializeGoals('active'),
        plot_goals_complete: serializeGoals('complete'),
        plot_goals_failed:   serializeGoals('failed'),
        plot_goals_hidden:   serializeGoals('hidden'),
        plot_goals_all:      serializeGoals('all')
    };
}

/**
 * Hook handler for GENERATE_BEFORE_COMBINE_PROMPTS.
 * Registers the global injection state block natively in SillyTavern.
 */
export function injectIntoPrompt() {
    const s = extension_settings[MODULE_NAME] || {};
    if (s.injectionMode === 'macro') {
        // If macro mode is active, clear the native extension prompt block
        setExtensionPrompt('plot_state_injection', '', -1, 0);
        return;
    }

    const injectionText = buildInjectionText();
    
    // Clear/disable the native extension prompt block if:
    // - injectionPosition is -1 (None / Disabled)
    // - injectionText is empty
    if (s.injectionPosition === -1 || !injectionText) {
        setExtensionPrompt('plot_state_injection', '', -1, 0);
        return;
    }

    const position = s.injectionPosition !== undefined ? Number(s.injectionPosition) : 0;
    const depth = s.injectionDepth !== undefined ? Number(s.injectionDepth) : 0;
    const role = s.injectionRole !== undefined ? Number(s.injectionRole) : 0;

    try {
        setExtensionPrompt(
            'plot_state_injection',
            injectionText.trim(),
            position,
            depth,
            false, // scan
            role
        );
        console.log(`[Plot Injection] Registered native ST prompt block. Position: ${position}, Depth: ${depth}, Role: ${role}`);
    } catch (e) {
        console.warn('[Plot Injection] Failed to set native extension prompt:', e);
    }
}
