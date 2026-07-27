/**
 * hooks.js - ST event hook registrations
 * Registers listeners for chat/character lifecycle events to keep Backstage state synced.
 */

import { loadPlotData } from './storage.js';
import { registerStoryPlanInjector } from './injector.js';
import { reloadStoryPlanPanes } from '../ui/tab-storyplan.js';

let _isLoadingPlotData = false;

async function safeLoadPlotData(source) {
    if (_isLoadingPlotData) {
        console.log(`[Plot Hooks] loadPlotData already in progress, skipping trigger from "${source}".`);
        return;
    }
    _isLoadingPlotData = true;
    try {
        await loadPlotData();
        await reloadStoryPlanPanes();
        console.log(`[Plot Hooks] ${source}: Loaded plot data.`);
    } catch (e) {
        console.error(`[Plot Hooks] Failed to load plot data on "${source}":`, e);
    } finally {
        _isLoadingPlotData = false;
    }
}

export function registerHooks(eventSource, event_types) {
    // Chat/Character changed: reload plot data & backstage history & StoryPlan panes
    eventSource.on(event_types.CHAT_CHANGED, () => {
        safeLoadPlotData('CHAT_CHANGED');
    });

    eventSource.on(event_types.CHARACTER_SELECTED, () => {
        safeLoadPlotData('CHARACTER_SELECTED');
    });

    // StoryPlan auto-injector for SillyTavern main chat generation
    registerStoryPlanInjector(eventSource, event_types);
}
