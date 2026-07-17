/**
 * macro.js - ST macro registration
 *
 * Registers plot-specific macros into SillyTavern's substituteParams system:
 *   {{plot_state}}      Full structured state block (variables + goals + storyline)
 *   {{plot_variables}}  Inline variable list
 *   {{plot_goals}}      Inline active goals list
 *   {{plot_storyline}}  Inline storyline progress
 *
 * Safe to register with either the modern MacroEngine/MacroRegistry or legacy fallbacks.
 */

import { macros, MacroCategory } from '../../../../../macros/macro-system.js';
import { MacrosParser } from '../../../../../macros.js';
import { getInjectionMacros } from '../core/injection.js';

const MACRO_PREFIX = 'plot';

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

    // Method 1: Try modern Macro Registry first (bypasses deprecation warnings)
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
        console.log('[Plot Macros] Registered macros via modern macros.register API.');
        return;
    }

    // Method 2: Legacy MacrosParser (falls back gracefully)
    if (typeof MacrosParser !== 'undefined' && MacrosParser && typeof MacrosParser.registerMacro === 'function') {
        MacrosParser.registerMacro(`${MACRO_PREFIX}_state`,     () => getInjectionMacros().plot_state, 'Full structured state block');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_variables`, () => getInjectionMacros().plot_variables, 'Inline variable list');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_goals`,     () => getInjectionMacros().plot_goals, 'Inline active goals list');
        MacrosParser.registerMacro(`${MACRO_PREFIX}_storyline`, () => getInjectionMacros().plot_storyline, 'Inline storyline progress');
        console.log('[Plot Macros] Registered macros via MacrosParser API.');
        return;
    }

    // Method 3: Context fallback
    if (typeof ctx.registerMacro === 'function') {
        ctx.registerMacro(`${MACRO_PREFIX}_state`,     () => getInjectionMacros().plot_state);
        ctx.registerMacro(`${MACRO_PREFIX}_variables`, () => getInjectionMacros().plot_variables);
        ctx.registerMacro(`${MACRO_PREFIX}_goals`,     () => getInjectionMacros().plot_goals);
        ctx.registerMacro(`${MACRO_PREFIX}_storyline`, () => getInjectionMacros().plot_storyline);
        console.log('[Plot Macros] Registered macros via getContext().registerMacro.');
        return;
    }

    // Method 4: Fallback — patch substituteParams
    if (typeof ctx.substituteParams === 'function') {
        const originalSubstituteParams = ctx.substituteParams.bind(ctx);
        ctx.substituteParams = function(text, ...args) {
            if (!text) return originalSubstituteParams(text, ...args);
            const m = getInjectionMacros();
            let result = text
                .replace(/\{\{plot_state\}\}/gi,     m.plot_state)
                .replace(/\{\{plot_variables\}\}/gi,  m.plot_variables)
                .replace(/\{\{plot_goals\}\}/gi,      m.plot_goals)
                .replace(/\{\{plot_storyline\}\}/gi,  m.plot_storyline);
            return originalSubstituteParams(result, ...args);
        };
        console.log('[Plot Macros] Registered macros via substituteParams patch.');
        return;
    }

    console.warn('[Plot Macros] No macro registration API found. Macros will not be substituted.');
}
