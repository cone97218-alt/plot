/**
 * injection.js - State injection pipeline (main chat prompt)
 *
 * Serialises the current active modules' state and appends it to the
 * GENERATE_BEFORE_COMBINE_PROMPTS hook.
 *
 * Two modes (controlled by extension_settings.plot.injectionMode):
 *   'auto'  - Automatically append to the generation context as a system message
 *   'macro' - User places {{plot_state}} etc. in their character card / system prompt;
 *             injection.js just supplies the text, macro.js handles substitution.
 *
 * Schema injected (as a structured block):
 *   [Plot State]
 *   Variables:  key: value, ...
 *   Goals:      [active] title, ...
 *   Storyline:  arc | chapter
 *   [/Plot State]
 */

import { get } from './store.js';
import { extension_settings } from '../../../../../extensions.js';
import { serializeVariablesInline, serializeGoalsInline, serializeStorylinesInline } from './serializers.js';

const MODULE_NAME = 'plot';

// ── Build injection text ───────────────────────────────────────────────────────

/**
 * Build the full injection text block for the active modules.
 * Returns empty string if injection is disabled or all modules are inactive.
 *
 * @returns {string}
 */
export function buildInjectionText() {
    const s = extension_settings[MODULE_NAME] || {};
    const modules = s.modules || {};

    // Check if injection is globally enabled
    if (s.injectionEnabled === false) return '';

    const lines = [];

    if (modules.variables !== false) {
        lines.push(`变量状态: ${serializeVariablesInline()}`);
    }
    if (modules.goals !== false) {
        lines.push(`当前目标: ${serializeGoalsInline()}`);
    }
    if (modules.storyline !== false) {
        lines.push(`故事线: ${serializeStorylinesInline()}`);
    }

    if (lines.length === 0) return '';

    return `\n\n[剧情状态]\n${lines.join('\n')}\n[/剧情状态]`;
}

/**
 * Expose the current state values for macro substitution.
 * Called by macro.js to resolve {{plot_state}}, {{plot_variables}}, etc.
 *
 * @returns {{ plot_state: string, plot_variables: string, plot_goals: string, plot_storyline: string }}
 */
export function getInjectionMacros() {
    return {
        plot_state:     buildInjectionText().trim(),
        plot_variables: serializeVariablesInline(),
        plot_goals:     serializeGoalsInline(),
        plot_storyline: serializeStorylinesInline()
    };
}

/**
 * Hook handler for GENERATE_BEFORE_COMBINE_PROMPTS.
 * In 'auto' mode, pushes a system-role injection entry into the chat context
 * that ST will include when assembling the final prompt.
 *
 * @param {Object} chatContext - The event payload from SillyTavern
 */
export function injectIntoPrompt(chatContext) {
    const s = extension_settings[MODULE_NAME] || {};
    if (s.injectionMode === 'macro') return; // macros handle it themselves
    if (s.injectionEnabled === false) return;

    const injectionText = buildInjectionText();
    if (!injectionText) return;

    // SillyTavern's GENERATE_BEFORE_COMBINE_PROMPTS event provides an array
    // at chatContext.chat or chatContext.prompt_manager_prompts that can be mutated.
    // We append a system-type injection entry if the API supports it.
    try {
        if (chatContext && Array.isArray(chatContext.chat)) {
            // Find the last system message index and insert after it
            const sysIdx = chatContext.chat.map(m => m.role).lastIndexOf('system');
            const insertAt = sysIdx === -1 ? 0 : sysIdx + 1;
            chatContext.chat.splice(insertAt, 0, {
                role: 'system',
                content: injectionText.trim(),
                injected: true,
                identifier: 'plot_state_injection'
            });
            console.log('[Plot Injection] Injected plot state into prompt.');
        }
    } catch (e) {
        console.warn('[Plot Injection] Could not inject into prompt context:', e);
    }
}
