/**
 * hooks.js - ST event hook registrations
 * Registers listeners for chat/character lifecycle and AI generation events.
 */

import { getContext } from '../../../../../extensions.js';
import { loadPlotData, savePlotData } from './storage.js';
import { parseMessage } from './output-parser.js';
import { injectIntoPrompt } from './injection.js';
import { evaluateKeywordGoals } from './goal-engine.js';

// Debounce guard: prevents concurrent loadPlotData calls when CHAT_CHANGED
// and CHARACTER_SELECTED fire in quick succession (e.g. on character switch).
let _isLoadingPlotData = false;

async function safeLoadPlotData(source) {
    if (_isLoadingPlotData) {
        console.log(`[Plot Hooks] loadPlotData already in progress, skipping trigger from "${source}".`);
        return;
    }
    _isLoadingPlotData = true;
    try {
        await loadPlotData();
        console.log(`[Plot Hooks] ${source}: Loaded plot data.`);
    } catch (e) {
        console.error(`[Plot Hooks] Failed to load plot data on "${source}":`, e);
    } finally {
        _isLoadingPlotData = false;
    }
}

export function registerHooks(eventSource, event_types) {
    // 1. Chat/Character changed: reload plot data layers
    eventSource.on(event_types.CHAT_CHANGED, () => {
        safeLoadPlotData('CHAT_CHANGED');
    });

    eventSource.on(event_types.CHARACTER_SELECTED, () => {
        safeLoadPlotData('CHARACTER_SELECTED');
    });

    // 2. Main story text generation event: trigger prompt injection
    eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, () => {
        try {
            injectIntoPrompt();
        } catch (e) {
            console.error('[Plot Hooks] Prompt injection failed:', e);
        }
    });

    // 3. Message received event: trigger parser scanning for AI replies
    eventSource.on(event_types.MESSAGE_RECEIVED, async (messageId) => {
        try {
            // B1 Fix: use imported getContext() instead of SillyTavern.getContext()
            const ctx = getContext();
            const message = ctx.chat[messageId];
            if (message && message.is_user === false) {
                parseMessage(message.mes);
                evaluateKeywordGoals(message.mes);
            }
        } catch (e) {
            console.error('[Plot Hooks] Output parsing failed for message:', messageId, e);
        }
    });
}
