/**
 * prompt-builder.js - Analysis prompt assembly + placeholder resolution
 *
 * Block structure:
 *   { identifier, name, content, enabled, role, order, builtin, moduleId }
 *
 * Built-in placeholders resolved by resolvePlaceholders():
 *   {{char_desc}}        {{user_desc}}
 *   {{world_info}}       {{world_info_before}}  {{world_info_after}}  {{world_info_depth}}
 *   {{chat_history}}     {{summary}}
 *   {{variables_list}}   {{goals_list}}         {{storyline_status}}
 *   {{response_format}}
 *
 * Preset management: built-in (not deletable, copyable) + user custom
 * AI output format: variables/goals → JSON; backstage → natural language
 */

import { getContext, extension_settings } from '../../../../../extensions.js';
import { get } from './store.js';
import { serializeVariables, serializeGoals, serializeStorylines } from './serializers.js';
import { buildInjectionText } from './injection.js';

const MODULE_NAME = 'plot';

// ── Built-in default blocks ────────────────────────────────────────────────────
const BUILTIN_BLOCKS = [];

// ── Helpers ────────────────────────────────────────────────────────────────────
function getPlotSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {};
    }
    return extension_settings[MODULE_NAME];
}

// Serialise functions (serializeVariables, serializeGoals, serializeStorylines) are imported from serializers.js

// ── Core API ───────────────────────────────────────────────────────────────────

/**
 * Resolve all {{placeholder}} tokens in a template string.
 * @param {string} text - Template string
 * @param {Object} context - Context data (from buildContext())
 * @param {Object} [extra] - Extra overrides (e.g. module_system_prompt)
 * @returns {string}
 */
export function resolvePlaceholders(text, context = {}, extra = {}) {
    if (!text) return text;

    let resolved = text;

    // Phase 1: Resolve extra placeholders and clean up deprecated slots
    const extraTokens = {
        '{{module_system_prompt}}': '',
        '{{module_user_prompt}}': '',
        '{{module_assistant_prompt}}': '',
        '{{response_format}}':     extra.response_format || '\n\n请仅以 JSON 格式输出，不要包含其他文本。',
        ...Object.fromEntries(
            Object.entries(extra).map(([k, v]) => [`{{${k}}}`, v])
        )
    };

    for (const [token, value] of Object.entries(extraTokens)) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        resolved = resolved.replace(new RegExp(escaped, 'g'), value);
    }

    // Get active character and user names from SillyTavern context
    const ctx = getContext ? getContext() : {};
    const charName = ctx.name2 || '';
    const userName = ctx.name1 || '';

    // Phase 2: Resolve standard context placeholders and native ST macros
    const standardTokens = {
        '{{char_desc}}':           context.char_desc || '',
        '{{user_desc}}':           context.user_desc || '',
        '{{world_info}}':          context.world_info || '',
        '{{world_info_before}}':   context.world_info_before || '',
        '{{world_info_after}}':    context.world_info_after || '',
        '{{world_info_depth}}':    context.world_info_depth || '',
        '{{chat_history}}':        context.chat_history || '',
        '{{summary}}':             context.summary || '',
        '{{guidance}}':            context.guidance || '',
        
        // SillyTavern global macros mapped to Backstage Workspace
        '{{plot_state}}':          buildInjectionText ? buildInjectionText().trim() : '',
        '{{plot_variables}}':      serializeVariables(),
        '{{plot_goals}}':          serializeGoals('active'),
        '{{plot_goals_active}}':   serializeGoals('active'),
        '{{plot_goals_complete}}': serializeGoals('complete'),
        '{{plot_goals_failed}}':   serializeGoals('failed'),
        '{{plot_goals_hidden}}':   serializeGoals('hidden'),
        '{{plot_goals_all}}':      serializeGoals('all'),
        '{{plot_storyline}}':      serializeStorylines(),
        
        '{{backstage_user_input}}': context.backstage_user_input || '',
        '{{backstage_chat_history}}': context.backstage_chat_history || '',
        '{{bts_user_input}}':       context.bts_user_input || '',
        '{{bts_chat_history}}':       context.bts_chat_history || '',
        '{{char}}':                charName,
        '{{character}}':           charName,
        '{{user}}':                userName
    };

    for (const [token, value] of Object.entries(standardTokens)) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        resolved = resolved.replace(new RegExp(escaped, 'g'), value);
    }

    return resolved;
}

/**
 * Get all blocks for a given module (global + module-specific), sorted by order.
 * Merges built-in defaults with user-saved overrides, and appends any custom blocks.
 * Blocks marked { deleted: true } in overrides are excluded.
 * @param {string} moduleId
 * @returns {Array}
 */
export function getBlocks(moduleId, presetIdOverride = null) {
    const s = getPlotSettings();
    const presetId = presetIdOverride || s.currentPreset?.[moduleId] || 'default';
    
    if (!s.presets) s.presets = {};
    if (!s.presets[moduleId]) s.presets[moduleId] = { 'default': { name: '默认预设' } };
    if (!s.presets[moduleId][presetId]) s.presets[moduleId][presetId] = { name: presetId === 'default' ? '默认预设' : '新预设' };
    
    const preset = s.presets[moduleId][presetId];
    if (!preset.promptBlocks) preset.promptBlocks = {};
    
    return Object.values(preset.promptBlocks)
        .filter(b => !b.deleted && b.moduleId === moduleId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Save a block's user override (content / enabled state) to extension_settings.
 * @param {Object} block - Full block object (identifier is required)
 */
export function saveBlock(block) {
    const s = getPlotSettings();
    const moduleId = block.moduleId;
    const presetId = s.currentPreset?.[moduleId] || 'default';
    
    if (!s.presets) s.presets = {};
    if (!s.presets[moduleId]) s.presets[moduleId] = {};
    if (!s.presets[moduleId][presetId]) s.presets[moduleId][presetId] = { name: presetId === 'default' ? '默认预设' : '新预设' };
    
    const preset = s.presets[moduleId][presetId];
    if (!preset.promptBlocks) preset.promptBlocks = {};
    
    preset.promptBlocks[block.identifier] = { ...block };
    getContext?.()?.saveSettingsDebounced?.();
}

/**
 * Reset a block's content back to its built-in default.
 * @param {string} identifier
 * @param {string} moduleId
 */
export function deleteBlock(identifier, moduleId) {
    const s = getPlotSettings();
    const presetId = s.currentPreset?.[moduleId] || 'default';
    const preset = s.presets?.[moduleId]?.[presetId];
    if (preset) {
        if (!preset.promptBlocks) preset.promptBlocks = {};
        const builtin = BUILTIN_BLOCKS.find(b => b.identifier === identifier);
        if (builtin) {
            preset.promptBlocks[identifier] = { ...builtin, deleted: true };
        } else {
            delete preset.promptBlocks[identifier];
        }
        getContext?.()?.saveSettingsDebounced?.();
    }
}

export function resetBlock(identifier, moduleId) {
    const s = getPlotSettings();
    const presetId = s.currentPreset?.[moduleId] || 'default';
    const preset = s.presets?.[moduleId]?.[presetId];
    if (preset && preset.promptBlocks && preset.promptBlocks[identifier]) {
        delete preset.promptBlocks[identifier];
        getContext?.()?.saveSettingsDebounced?.();
    }
}

/**
 * Helper to assemble and resolve prompts for a specific role (system / user / assistant),
 * preserving correct block order and handling global wrappers like global_system / global_user.
 */
function assemblePromptForRole(role, moduleId, blocks, context) {
    const roleBlocks = blocks.filter(b => b.role === role);
    return roleBlocks
        .map(b => resolvePlaceholders(b.content, context))
        .filter(Boolean)
        .join('\n\n');
}

/**
 * Assemble system + user + assistant messages for a given module,
 * with all placeholders resolved against the provided context.
 *
 * @param {string} moduleId - 'global' | 'variables' | 'goals' | 'storyline' | 'backstage'
 * @param {Object} context  - Output of buildContext()
 * @param {Object} [overrides] - Optional { systemPrompt, userPrompt } to bypass block system
 * @returns {{ system: string, user: string, assistant: string }}
 */
export function assemblePrompt(moduleId, context = {}, overrides = {}, presetIdOverride = null) {
    // If caller supplies explicit system/user text, just resolve placeholders
    if (overrides.systemPrompt !== undefined || overrides.userPrompt !== undefined) {
        const systemText = resolvePlaceholders(overrides.systemPrompt    || '', context);
        const userText = resolvePlaceholders(overrides.userPrompt      || '', context);
        const assistantText = resolvePlaceholders(overrides.assistantPrompt || '', context);
        
        const messages = [];
        if (systemText) messages.push({ role: 'system', content: systemText });
        if (userText) messages.push({ role: 'user', content: userText });
        if (assistantText) messages.push({ role: 'assistant', content: assistantText });

        return {
            system:    systemText,
            user:      userText,
            assistant: assistantText,
            messages
        };
    }

    const blocks = getBlocks(moduleId, presetIdOverride).filter(b => {
        if (b.enabled) {
            if (b.identifier.endsWith('_ai_gen') && b.moduleId !== moduleId) {
                return false;
            }
            return true;
        }
        return false;
    });

    const systemText = assemblePromptForRole('system', moduleId, blocks, context);
    const userText = assemblePromptForRole('user', moduleId, blocks, context);
    const assistantText = assemblePromptForRole('assistant', moduleId, blocks, context);

    const messages = blocks.map(b => {
        return {
            role: b.role === 'system' ? 'system' : (b.role === 'assistant' ? 'assistant' : 'user'),
            name: b.name,
            content: resolvePlaceholders(b.content, context)
        };
    }).filter(m => m.content);

    return { system: systemText, user: userText, assistant: assistantText, messages };
}

export function getBlockContent(moduleId, identifier, presetIdOverride = null) {
    const blocks = getBlocks(moduleId, presetIdOverride);
    const block = blocks.find(b => b.identifier === identifier);
    return block ? block.content : '';
}
