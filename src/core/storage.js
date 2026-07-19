import { getContext, extension_settings, writeExtensionField } from '../../../../../extensions.js';
import { saveSettings } from '../../../../../../script.js';
import { migrate } from './migrator.js';
import { set, get } from './store.js';
import { getPlotValue, savePlotValue, clearAllPlotDB } from './indexeddb.js';
import { registerDynamicVariableMacros, registerDynamicCategoryMacros } from '../utils/macro.js';
import { injectIntoPrompt } from './injection.js';

/**
 * Build the IndexedDB key for a backstage history record.
 * @param {string} [overrideModeId]   - If provided, use this instead of the current active mode ID.
 * @param {string} [overrideThreadId] - If provided, use this instead of the mode's active thread ID.
 * @returns {string} The full DB key string.
 */
export function getBtsDBKey(overrideModeId, overrideThreadId) {
    const ctx = getContext();
    const ep = extension_settings.plot;
    if (!ep) return 'global_bts_default_default';

    const modeId = overrideModeId || get('backstageActiveModeId') || 'default';
    const modes = ep.backstageModes || [];
    const mode = modes.find(m => m.id === modeId) || { id: 'default', storageScope: 'chat', activeThreadId: 'default' };

    const scope = mode.storageScope || 'chat';
    const chId = ctx.characterId;
    const threadId = overrideThreadId || mode.activeThreadId || 'default';

    if (scope === 'chat') {
        const chatId = ctx.getCurrentChatId() || 'unknown';
        return `chat_${chId}_${chatId}_bts_${modeId}_${threadId}`;
    }
    if (scope === 'character') {
        return `char_${chId}_bts_${modeId}_${threadId}`;
    }
    return `global_bts_${modeId}_${threadId}`;
}

export async function loadPlotData() {
    set('isLoading', true);
    const ctx = getContext();
    
    // Ensure global settings exist
    if (!extension_settings.plot) {
        extension_settings.plot = {
            version: '0.4.0',
            modules: {
                variables: true,
                goals: true,
                storyline: true,
                backstage: true,
            },
            panelPosition: 'normal',
            panelSize: '80%',
            connections: [],
            prompts: [],
        };
    }
    
    const ep = extension_settings.plot;
    // Set backstage defaults if not present
    if (!ep.backstageModes) {
        ep.backstageModes = [
            {
                id: 'default',
                name: '默认模式',
                presetId: 'default',
                connectionId: 'default',
                storageScope: 'chat',
                activeThreadId: 'default',
                threads: [ { id: 'default', name: '默认分支' } ],
                reading: {
                    historyLimit: 20,
                    regexRules: [],
                    injectCharacterDescription: true,
                    injectUserDescription: true,
                    injectCharacterLorebook: true,
                    injectGlobalLorebook: true,
                    injectChatLorebook: true,
                    lorebookExcludePrefixes: '',
                    lorebookIncludeFilter: '',
                    customLorebookName: '',
                    manuallySelectedEntries: [],
                    summaryJsExpression: ''
                }
            }
        ];
    }
    
    // Self-healing / Upgrade existing modes for threads support
    if (ep.backstageModes) {
        ep.backstageModes.forEach(m => {
            if (!m.threads) {
                m.threads = [ { id: 'default', name: '默认分支' } ];
            }
            if (!m.activeThreadId) {
                m.activeThreadId = 'default';
            }
            if (!m.storageScope) {
                // Migrate old global storage scope setting to mode scope if possible
                m.storageScope = ep.backstageStorageScope || 'chat';
            }
        });
    }

    if (!ep.backstageThemes) ep.backstageThemes = [];
    if (!ep.backstageActiveModeId) ep.backstageActiveModeId = 'default';
    if (!ep.backstageActiveThemeId) ep.backstageActiveThemeId = 'default';
    if (!ep.backstageAvatarOption) ep.backstageAvatarOption = 'show-frame';
    if (!ep.backstageStorageScope) ep.backstageStorageScope = 'chat';
    if (!ep.backstageGlobalHistory) ep.backstageGlobalHistory = {};

    ctx.saveSettingsDebounced();
    
    let plotData = {
        version: '0.4.0',
        modules: { ...ep.modules },
        variables: {},
        goals: {},
        storylines: {},
        backstageHistory: {},
    };
    
    // Sync settings keys into store
    set('backstageActiveModeId', ep.backstageActiveModeId);
    set('backstageActiveThemeId', ep.backstageActiveThemeId);
    set('backstageAvatarOption', ep.backstageAvatarOption);
    set('backstageStorageScope', ep.backstageStorageScope);

    // 1. Merge templates from Character V2 card extensions
    const chId = ctx.characterId;
    const chatId = ctx.getCurrentChatId() || 'unknown';
    let templates = {
        variables: {},
        goals: {},
        storylines: {}
    };
    let oldCharBtsHistory = null;

    if (chId !== undefined && ctx.characters[chId]) {
        const charExtensions = ctx.characters[chId].data?.extensions;
        if (charExtensions && charExtensions.plot) {
            const migratedCharData = migrate(charExtensions.plot);
            if (migratedCharData.variables) templates.variables = migratedCharData.variables;
            if (migratedCharData.goals) templates.goals = migratedCharData.goals;
            if (migratedCharData.storylines) templates.storylines = migratedCharData.storylines;
            if (migratedCharData.backstageHistory && Object.keys(migratedCharData.backstageHistory).length > 0) {
                oldCharBtsHistory = migratedCharData.backstageHistory;
            }
        }
    }
    
    // 2. Load active progress from IndexedDB in parallel
    const varKey = `active_vars_${chId}_${chatId}`;
    const goalKey = `active_goals_${chId}_${chatId}`;
    const storylineKey = `active_storylines_${chId}_${chatId}`;
    const pinKey = `pinned_goals_${chId}_${chatId}`;
    const dbKey = getBtsDBKey();

    let [activeVars, activeGoals, activeStorylines, pinnedGoalIds, backstageHistory] = await Promise.all([
        getPlotValue(varKey),
        getPlotValue(goalKey),
        getPlotValue(storylineKey),
        getPlotValue(pinKey),
        getPlotValue(dbKey)
    ]);

    // Merge Chat-level progress & migrate if present in chatMetadata
    let oldChatBtsHistory = null;
    if (ctx.chatMetadata) {
        if (!ctx.chatMetadata.plot) {
            ctx.chatMetadata.plot = {
                version: '0.4.0',
                variables: {},
                goals: {},
                storylines: {},
                backstageHistory: {},
            };
            ctx.saveMetadataDebounced();
        }
        
        const migratedChatData = migrate(ctx.chatMetadata.plot);
        
        // Eager legacy migration for variables, goals, storylines
        if (!activeVars && migratedChatData.variables && Object.keys(migratedChatData.variables).length > 0) {
            activeVars = migratedChatData.variables;
            await savePlotValue(varKey, activeVars);
            ctx.chatMetadata.plot.variables = {};
        }
        if (!activeGoals && migratedChatData.goals && Object.keys(migratedChatData.goals).length > 0) {
            activeGoals = migratedChatData.goals;
            await savePlotValue(goalKey, activeGoals);
            ctx.chatMetadata.plot.goals = {};
        }
        if (!activeStorylines && migratedChatData.storylines && Object.keys(migratedChatData.storylines).length > 0) {
            activeStorylines = migratedChatData.storylines;
            await savePlotValue(storylineKey, activeStorylines);
            ctx.chatMetadata.plot.storylines = {};
        }
        if (migratedChatData.backstageHistory && Object.keys(migratedChatData.backstageHistory).length > 0) {
            oldChatBtsHistory = migratedChatData.backstageHistory;
        }
        ctx.saveMetadataDebounced();
    }

    // Fallback to templates if no active progress is found in IndexedDB
    if (!activeVars || Object.keys(activeVars).length === 0) activeVars = templates.variables;
    if (!activeGoals || Object.keys(activeGoals).length === 0) activeGoals = templates.goals;
    if (!activeStorylines || Object.keys(activeStorylines).length === 0) activeStorylines = templates.storylines;

    plotData.variables = activeVars;
    plotData.goals = activeGoals;
    plotData.storylines = activeStorylines;

    if (!Array.isArray(pinnedGoalIds)) {
        pinnedGoalIds = [];
    }
    set('pinnedGoalIds', pinnedGoalIds);

    // 3. Load Backstage History from IndexedDB (already loaded in parallel)
    
    // Auto-migration check: If IndexedDB is empty, but we have old legacy history, migrate it!
    if (!backstageHistory || Object.keys(backstageHistory).length === 0) {
        backstageHistory = {};
        const activeModeId = get('backstageActiveModeId') || 'default';
        const modes = ep.backstageModes || [];
        const mode = modes.find(m => m.id === activeModeId) || { id: 'default', storageScope: 'chat' };
        const scope = mode.storageScope || 'chat';
        let migrated = false;
        
        // Find if old legacy history contains this mode's history
        let oldHistoryForMode = null;
        if (scope === 'chat' && oldChatBtsHistory && oldChatBtsHistory[activeModeId]) {
            oldHistoryForMode = oldChatBtsHistory[activeModeId];
        } else if (scope === 'character' && oldCharBtsHistory && oldCharBtsHistory[activeModeId]) {
            oldHistoryForMode = oldCharBtsHistory[activeModeId];
        } else if (scope === 'global' && ep.backstageGlobalHistory && ep.backstageGlobalHistory[activeModeId]) {
            oldHistoryForMode = ep.backstageGlobalHistory[activeModeId];
        }
        
        if (oldHistoryForMode && oldHistoryForMode.length > 0) {
            backstageHistory = oldHistoryForMode;
            migrated = true;
        }
        
        if (migrated) {
            console.log(`[Plot Storage] Migrated legacy backstage history for mode "${activeModeId}" key "${dbKey}" to IndexedDB.`);
            await savePlotValue(dbKey, backstageHistory);
            
            // Clean up old legacy slots
            if (scope === 'chat' && ctx.chatMetadata?.plot?.backstageHistory) {
                delete ctx.chatMetadata.plot.backstageHistory[activeModeId];
                ctx.saveMetadataDebounced();
            } else if (scope === 'character' && chId !== undefined && ctx.characters[chId]) {
                const currentPlot = ctx.characters[chId].data?.extensions?.plot || {};
                if (currentPlot.backstageHistory) {
                    delete currentPlot.backstageHistory[activeModeId];
                    await writeExtensionField(chId, 'plot', currentPlot);
                }
            } else if (scope === 'global' && ep.backstageGlobalHistory) {
                delete ep.backstageGlobalHistory[activeModeId];
                ctx.saveSettingsDebounced();
            }
        }
    }
    
    // Ensure it is loaded as an array (messages array)
    if (!Array.isArray(backstageHistory)) {
        backstageHistory = [];
    }
    plotData.backstageHistory = backstageHistory;
    
    // Sync into store
    set('version', plotData.version);
    set('modules', plotData.modules);
    set('variables', plotData.variables);
    set('goals', plotData.goals);
    set('storylines', plotData.storylines);
    set('backstageHistory', plotData.backstageHistory);
    set('backstageHistoryLoadedKey', dbKey);
    registerDynamicVariableMacros();
    registerDynamicCategoryMacros();
    set('isLoading', false);
}

export async function savePlotData() {
    const ctx = getContext();
    const ep = extension_settings.plot;
    if (!ep) return;
    
    const chId = ctx.characterId;
    const chatId = ctx.getCurrentChatId() || 'unknown';

    // 1. Save global settings
    ep.modules = get('modules') || {};
    ep.backstageActiveModeId = get('backstageActiveModeId') || 'default';
    ep.backstageActiveThemeId = get('backstageActiveThemeId') || 'default';
    ep.backstageAvatarOption = get('backstageAvatarOption') || 'show-frame';
    ep.backstageStorageScope = get('backstageStorageScope') || 'chat';
    ep.backstageGlobalHistory = {}; // Keep settings clean
    ctx.saveSettingsDebounced();
    
    // 2. Save active progress to IndexedDB
    const varKey = `active_vars_${chId}_${chatId}`;
    const goalKey = `active_goals_${chId}_${chatId}`;
    const storylineKey = `active_storylines_${chId}_${chatId}`;
    const pinKey = `pinned_goals_${chId}_${chatId}`;

    await savePlotValue(varKey, get('variables') || {});
    await savePlotValue(goalKey, get('goals') || {});
    await savePlotValue(storylineKey, get('storylines') || {});
    await savePlotValue(pinKey, get('pinnedGoalIds') || []);

    // 3. Keep chatMetadata clean of actual history/data
    if (ctx.chatMetadata) {
        ctx.chatMetadata.plot = {
            version: get('version') || '0.4.0',
            variables: {},
            goals: {},
            storylines: {},
            backstageHistory: {}, // Keep metadata empty of backstageHistory!
        };
        ctx.saveMetadataDebounced();
    }

    // 4. Save backstageHistory for current active mode and active thread to IndexedDB
    const dbKey = getBtsDBKey();
    const loadedKey = get('backstageHistoryLoadedKey');
    if (loadedKey === dbKey) {
        const history = get('backstageHistory') || [];
        await savePlotValue(dbKey, history);
    } else {
        console.log(`[Plot Storage] Skipping backstage history save to key "${dbKey}" because loadedKey is "${loadedKey}"`);
    }

    // Proactively refresh extension prompt injection state!
    try {
        injectIntoPrompt();
    } catch (e) {
        console.warn('[Plot Storage] Failed to update prompt injection:', e);
    }
}

export function exportPlotData() {
    const data = {
        version: get('version') || '0.4.0',
        variables: get('variables') || {},
        goals: get('goals') || {},
        storylines: get('storylines') || {},
    };
    return JSON.stringify(data, null, 2);
}

export async function importPlotData(jsonString) {
    try {
        const rawData = JSON.parse(jsonString);
        const migratedData = migrate(rawData);
        
        set('version', migratedData.version);
        set('variables', migratedData.variables || {});
        set('goals', migratedData.goals || {});
        set('storylines', migratedData.storylines || {});
        
        await savePlotData();
        return true;
    } catch (e) {
        console.error('[Plot Storage] Failed to import plot data:', e);
        return false;
    }
}

export async function resetAllPlotData() {
    const ctx = getContext();
    
    // 1. Clear IndexedDB
    await clearAllPlotDB();
    
    // 2. Reset global settings
    extension_settings.plot = {
        version: '0.4.0',
        modules: {
            variables: true,
            goals: true,
            storyline: true,
            backstage: true,
        },
        panelPosition: 'normal',
        panelSize: '80%',
        connections: [],
        prompts: [],
        backstageModes: [
            {
                id: 'default',
                name: '默认模式',
                presetId: 'default',
                connectionId: 'default',
                storageScope: 'chat',
                activeThreadId: 'default',
                threads: [ { id: 'default', name: '默认分支' } ],
                reading: {
                    historyLimit: 20,
                    regexRules: [],
                    injectCharacterDescription: true,
                    injectUserDescription: true,
                    injectCharacterLorebook: true,
                    injectGlobalLorebook: true,
                    injectChatLorebook: true,
                    lorebookExcludePrefixes: '',
                    lorebookIncludeFilter: '',
                    customLorebookName: '',
                    manuallySelectedEntries: [],
                    summaryJsExpression: ''
                }
            }
        ],
        backstageThemes: [],
        backstageActiveModeId: 'default',
        backstageActiveThemeId: 'default',
        backstageAvatarOption: 'show-frame',
        backstageStorageScope: 'chat',
        backstageGlobalHistory: {},
        presets: {
            global:    { 'default': { name: '默认预设' } },
            variables: { 'default': { name: '默认预设' } },
            goals:     { 'default': { name: '默认预设' } },
            storyline: { 'default': { name: '默认预设' } },
            backstage: { 'default': { name: '默认预设' } },
        },
        currentPreset: {
            global: 'default',
            variables: 'default',
            goals: 'default',
            storyline: 'default',
            backstage: 'default'
        },
        streamModules: {
            variables: false,
            goals: false,
            storyline: false,
            backstage: true
        },
        reading: {
            historyLimit: 20,
            regexRules: [],
            injectCharacterDescription: true,
            injectUserDescription: true,
            injectCharacterLorebook: true,
            injectGlobalLorebook: true,
            injectChatLorebook: true,
            lorebookExcludePrefixes: '',
            lorebookIncludeFilter: '',
            customLorebookName: '',
            manuallySelectedEntries: [],
            summaryJsExpression: ''
        }
    };
    
    // 3. Reset character V2 extensions
    const chId = ctx.characterId;
    if (chId !== undefined && ctx.characters[chId]) {
        await writeExtensionField(chId, 'plot', {});
    }
    
    // 4. Reset Chat Metadata
    if (ctx.chatMetadata) {
        ctx.chatMetadata.plot = {
            version: '0.4.0',
            variables: {},
            goals: {},
            storylines: {},
            backstageHistory: {},
        };
    }
    
    // 5. Reset store keys
    set('version', '0.4.0');
    set('modules', extension_settings.plot.modules);
    set('variables', {});
    set('goals', {});
    set('storylines', {});
    set('backstageHistory', []); // Empty array
    set('backstageActiveModeId', 'default');
    set('backstageActiveThemeId', 'default');
    set('backstageAvatarOption', 'show-frame');
    set('backstageStorageScope', 'chat');
    
    // 6. Save all resets immediately to prevent location.reload from aborting debounced writes
    if (ctx.chatMetadata) {
        await ctx.saveMetadata();
    }
    await saveSettings();
}
