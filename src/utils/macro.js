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
import { getInjectionMacros, formatVariableLine, formatGoalLine } from '../core/injection.js';
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
        macros.register(`${MACRO_PREFIX}_goals_active`, {
            category: cat,
            description: 'Active goals tree list',
            handler: () => getInjectionMacros().plot_goals_active,
        });
        macros.register(`${MACRO_PREFIX}_goals_complete`, {
            category: cat,
            description: 'Completed goals tree list',
            handler: () => getInjectionMacros().plot_goals_complete,
        });
        macros.register(`${MACRO_PREFIX}_goals_failed`, {
            category: cat,
            description: 'Failed goals tree list',
            handler: () => getInjectionMacros().plot_goals_failed,
        });
        macros.register(`${MACRO_PREFIX}_goals_hidden`, {
            category: cat,
            description: 'Hidden goals tree list',
            handler: () => getInjectionMacros().plot_goals_hidden,
        });
        macros.register(`${MACRO_PREFIX}_goals_all`, {
            category: cat,
            description: 'All goals tree list',
            handler: () => getInjectionMacros().plot_goals_all,
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
        MacrosParser.registerMacro(`${MACRO_PREFIX}_goals_active`,  () => getInjectionMacros().plot_goals_active, 'Active goals tree list');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_goals_complete`,() => getInjectionMacros().plot_goals_complete, 'Completed goals tree list');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_goals_failed`,  () => getInjectionMacros().plot_goals_failed, 'Failed goals tree list');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_goals_hidden`,  () => getInjectionMacros().plot_goals_hidden, 'Hidden goals tree list');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_goals_all`,     () => getInjectionMacros().plot_goals_all, 'All goals tree list');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_storyline`, () => getInjectionMacros().plot_storyline, 'Inline storyline progress');
        console.log('[Plot Macros] Registered static macros via MacrosParser API.');
    } else if (typeof ctx.registerMacro === 'function') {
        ctx.registerMacro(`${MACRO_PREFIX}_state`,     () => getInjectionMacros().plot_state);
        ctx.registerMacro(`${MACRO_PREFIX}_variables`, () => getInjectionMacros().plot_variables);
        ctx.registerMacro(`${MACRO_PREFIX}_goals`,     () => getInjectionMacros().plot_goals);
        ctx.registerMacro(`${MACRO_PREFIX}_goals_active`,   () => getInjectionMacros().plot_goals_active);
        ctx.registerMacro(`${MACRO_PREFIX}_goals_complete`, () => getInjectionMacros().plot_goals_complete);
        ctx.registerMacro(`${MACRO_PREFIX}_goals_failed`,   () => getInjectionMacros().plot_goals_failed);
        ctx.registerMacro(`${MACRO_PREFIX}_goals_hidden`,   () => getInjectionMacros().plot_goals_hidden);
        ctx.registerMacro(`${MACRO_PREFIX}_goals_all`,      () => getInjectionMacros().plot_goals_all);
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
            // Dynamically replace all macros defined in m, covering static and dynamic categories
            Object.keys(m).forEach(macroKey => {
                const regex = new RegExp(`\\{\\{${macroKey}\\}\\}`, 'gi');
                result = result.replace(regex, m[macroKey] || '');
            });

            // Fallback dynamic regex parsing for category-status macros: {{plot_[category]_[status]}}
            result = result.replace(/\{\{plot_([a-zA-Z0-9_]+?)_([a-zA-Z0-9_]+?)\}\}/gi, (match, categoryRaw, statusRaw) => {
                const category = categoryRaw.toLowerCase();
                const status = statusRaw.toLowerCase();
                if (category === 'var') return match; // Handled by variable macro regex

                const staticMacros = ['state', 'variables', 'goals', 'storyline'];
                if (staticMacros.includes(category) && !statusRaw) return match;

                const macroKey = `plot_${category}_${status}`;
                if (m.hasOwnProperty(macroKey)) {
                    return m[macroKey];
                }

                // Calculate on the fly for unregistered category/status combinations
                const goals = get('goals') || {};
                const goalList = Object.values(goals);
                const pinnedIds = get('pinnedGoalIds') || [];
                const goalInject = ctx.extensionSettings?.plot?.goalInjection || {};
                const lineTemplate = goalInject.lineTemplate || "【{{title}}】{{desc}}";

                const catSingular = category.endsWith('s') ? category.slice(0, -1) : category;
                const filtered = goalList.filter(g => {
                    const goalCat = String(g.category || '').trim().toLowerCase();
                    const goalCatSingular = goalCat.endsWith('s') ? goalCat.slice(0, -1) : goalCat;
                    return (goalCat === category || goalCatSingular === catSingular) &&
                           (g.status === status || (status === 'active' && !g.status));
                });

                return filtered.map(g => formatGoalLine(g, lineTemplate)).filter(Boolean).join('\n');
            });

            return originalSubstituteParams(result, ...args);
        };
        console.log('[Plot Macros] Patching substituteParams for regular expression dynamic macro mapping.');
    }
}

/**
 * Dynamically register macros natively in ST's modern system for each current category.
 */
export function registerDynamicCategoryMacros() {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx) return;

    if (macros && typeof macros.register === 'function') {
        const goals = get('goals') || {};
        const uniqueCategories = new Set();
        Object.values(goals).forEach(g => {
            if (g.category && String(g.category).trim() !== '') {
                uniqueCategories.add(String(g.category).trim().toLowerCase());
            }
        });

        const statuses = ['locked', 'unlocked', 'active', 'complete', 'failed', 'hidden'];
        const goalInject = ctx.extensionSettings?.plot?.goalInjection || {};
        const lineTemplate = goalInject.lineTemplate || "【{{title}}】{{desc}}";

        uniqueCategories.forEach(cat => {
            const catSingular = cat;
            const normalizedPlural = cat.endsWith('s') ? cat : cat + 's';

            statuses.forEach(status => {
                const keySingular = `plot_${catSingular}_${status}`;
                const keyPlural = `plot_${normalizedPlural}_${status}`;

                try {
                    macros.register(keySingular, {
                        category: MacroCategory.CHAT,
                        description: `Plot dynamic category ${catSingular} status: ${status}`,
                        handler: () => getInjectionMacros()[keySingular] || ''
                    });
                    macros.register(keyPlural, {
                        category: MacroCategory.CHAT,
                        description: `Plot dynamic category ${normalizedPlural} status: ${status}`,
                        handler: () => getInjectionMacros()[keyPlural] || ''
                    });
                } catch (e) {}
            });
        });
    }
}
