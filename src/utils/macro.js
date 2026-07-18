/**
 * macro.js - ST macro registration
 *
 * Registers plot-specific macros into SillyTavern's substituteParams system:
 *   {{plot_state}}      Full structured state block (variables + goals + storyline)
 *   {{plot_variables}}  Inline variable list
 *   {{plot_goals}}      Inline active goals list
 *   {{plot_storyline}}  Inline storyline progress
 *
 * Supports dynamic specific variable macros:
 *   {{plot_var_ID}}       Variable value (compact)
 *   {{plot_var_ID_tree}}  Variable JSON tree (for objects/arrays)
 *   {{plot_var_ID_line}}  Variable formatted line (using its custom template)
 */

import { macros, MacroCategory } from '../../../../../macros/macro-system.js';
import { MacrosParser } from '../../../../../macros.js';
import { get } from '../core/store.js';
import { getInjectionMacros, formatVariableLine } from '../core/injection.js';
import { serializeComplexInline, formatComplexValue } from '../core/serializers.js';

const MACRO_PREFIX = 'plot';

/**
 * Dynamically register macros for each currently defined variable.
 */
export function registerDynamicVariableMacros() {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx) return;

    const vars = get('variables') || {};
    Object.keys(vars).forEach(key => {
        const baseMacro = `${MACRO_PREFIX}_var_${key}`;
        const treeMacro = `${MACRO_PREFIX}_var_${key}_tree`;
        const lineMacro = `${MACRO_PREFIX}_var_${key}_line`;

        // Modern macros.register API
        if (macros && typeof macros.register === 'function') {
            try {
                macros.register(baseMacro, {
                    category: MacroCategory.CHAT,
                    description: `Plot variable value: ${key}`,
                    handler: () => {
                        const v = get('variables')?.[key];
                        return v ? serializeComplexInline(v.value).trim() : '';
                    }
                });
                macros.register(treeMacro, {
                    category: MacroCategory.CHAT,
                    description: `Plot variable tree: ${key}`,
                    handler: () => {
                        const v = get('variables')?.[key];
                        return v ? formatComplexValue(v.value, 0).trim() : '';
                    }
                });
                macros.register(lineMacro, {
                    category: MacroCategory.CHAT,
                    description: `Plot variable line: ${key}`,
                    handler: () => {
                        const v = get('variables')?.[key];
                        return v ? formatVariableLine(v, '- {{name}}: {{value}}').trim() : '';
                    }
                });
            } catch (e) {}
        }

        // Legacy MacrosParser API
        if (typeof MacrosParser !== 'undefined' && MacrosParser && typeof MacrosParser.registerMacro === 'function') {
            try {
                MacrosParser.registerMacro(baseMacro, () => {
                    const v = get('variables')?.[key];
                    return v ? serializeComplexInline(v.value).trim() : '';
                }, `Plot variable value: ${key}`);
                MacrosParser.registerMacro(treeMacro, () => {
                    const v = get('variables')?.[key];
                    return v ? formatComplexValue(v.value, 0).trim() : '';
                }, `Plot variable tree: ${key}`);
                MacrosParser.registerMacro(lineMacro, () => {
                    const v = get('variables')?.[key];
                    return v ? formatVariableLine(v, '- {{name}}: {{value}}').trim() : '';
                }, `Plot variable line: ${key}`);
            } catch (e) {}
        }

        // Legacy getContext().registerMacro API
        if (typeof ctx.registerMacro === 'function') {
            try {
                ctx.registerMacro(baseMacro, () => {
                    const v = get('variables')?.[key];
                    return v ? serializeComplexInline(v.value).trim() : '';
                });
                ctx.registerMacro(treeMacro, () => {
                    const v = get('variables')?.[key];
                    return v ? formatComplexValue(v.value, 0).trim() : '';
                });
                ctx.registerMacro(lineMacro, () => {
                    const v = get('variables')?.[key];
                    return v ? formatVariableLine(v, '- {{name}}: {{value}}').trim() : '';
                });
            } catch (e) {}
        }
    });
}

/**
 * Register all Plot macros with SillyTavern's macro system.
 * Safe to call multiple times (checks for existing registration).
 */
export function registerMacros() {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx) {
        console.warn('[Plot Macros] SillyTavern context not available; skipping macro registration.');
        return;
    }

    // Register dynamic variables macros first
    registerDynamicVariableMacros();

    // Register modern/standard static macros
    if (macros && typeof macros.register === 'function') {
        const cat = MacroCategory.CHAT;
        macros.register(`${MACRO_PREFIX}_state`, {
            category: cat,
            description: 'Full structured state block (variables + goals + storyline)',
            handler: () => getInjectionMacros().plot_state,
        });
        macros.register(`${MACRO_PREFIX}_variables`, {
            category: cat,
            description: 'Inline variable list',
            handler: () => getInjectionMacros().plot_variables,
        });
        macros.register(`${MACRO_PREFIX}_goals`, {
            category: cat,
            description: 'Inline active goals list',
            handler: () => getInjectionMacros().plot_goals,
        });
        macros.register(`${MACRO_PREFIX}_storyline`, {
            category: cat,
            description: 'Inline storyline progress',
            handler: () => getInjectionMacros().plot_storyline,
        });
        console.log('[Plot Macros] Registered static macros via modern macros.register API.');
    } else if (typeof MacrosParser !== 'undefined' && MacrosParser && typeof MacrosParser.registerMacro === 'function') {
        MacrosParser.registerMacro(`${MACRO_PREFIX}_state`,     () => getInjectionMacros().plot_state, 'Full structured state block');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_variables`, () => getInjectionMacros().plot_variables, 'Inline variable list');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_goals`,     () => getInjectionMacros().plot_goals, 'Inline active goals list');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_storyline`, () => getInjectionMacros().plot_storyline, 'Inline storyline progress');
        console.log('[Plot Macros] Registered static macros via MacrosParser API.');
    } else if (typeof ctx.registerMacro === 'function') {
        ctx.registerMacro(`${MACRO_PREFIX}_state`,     () => getInjectionMacros().plot_state);
        ctx.registerMacro(`${MACRO_PREFIX}_variables`, () => getInjectionMacros().plot_variables);
        ctx.registerMacro(`${MACRO_PREFIX}_goals`,     () => getInjectionMacros().plot_goals);
        ctx.registerMacro(`${MACRO_PREFIX}_storyline`, () => getInjectionMacros().plot_storyline);
        console.log('[Plot Macros] Registered static macros via getContext().registerMacro.');
    }

    // Fallback — patch substituteParams for regular expression substitutions
    if (typeof ctx.substituteParams === 'function') {
        const originalSubstituteParams = ctx.substituteParams.bind(ctx);
        ctx.substituteParams = function(text, ...args) {
            if (!text) return originalSubstituteParams(text, ...args);

            // Dynamic specific variables macro regex matching
            let result = text.replace(/\{\{plot_var_([a-zA-Z0-9_]+?)(?:_(line|tree))?\}\}/gi, (match, varId, format) => {
                const vars = get('variables') || {};
                const v = vars[varId];
                if (!v) return '';

                if (format === 'tree') {
                    return formatComplexValue(v.value, 0).trim();
                } else if (format === 'line') {
                    return formatVariableLine(v, '- {{name}}: {{value}}').trim();
                } else {
                    return serializeComplexInline(v.value).trim();
                }
            });

            const m = getInjectionMacros();
            result = result
                .replace(/\{\{plot_state\}\}/gi,     m.plot_state)
                .replace(/\{\{plot_variables\}\}/gi,  m.plot_variables)
                .replace(/\{\{plot_goals\}\}/gi,      m.plot_goals)
                .replace(/\{\{plot_storyline\}\}/gi,  m.plot_storyline);

            return originalSubstituteParams(result, ...args);
        };
        console.log('[Plot Macros] Patching substituteParams for regular expression dynamic macro mapping.');
    }
}
