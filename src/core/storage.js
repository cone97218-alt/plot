import { getContext, extension_settings, writeExtensionField } from '../../../../../extensions.js';
import { saveSettings } from '../../../../../../script.js';
import { migrate } from './migrator.js';
import { set, get } from './store.js';
import { getPlotValue, savePlotValue, clearAllPlotDB } from './indexeddb.js';

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
            version: '0.5.0',
            modules: {
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
                m.storageScope = ep.backstageStorageScope || 'chat';
            }
        });
    }

    if (!ep.backstageThemes) ep.backstageThemes = [];
    if (!ep.backstageActiveModeId) ep.backstageActiveModeId = 'default';
    if (!ep.backstageActiveThemeId) ep.backstageActiveThemeId = 'default';
    if (!ep.backstageAvatarOption) ep.backstageAvatarOption = 'show-frame';
    if (!ep.backstageStorageScope) ep.backstageStorageScope = 'chat';

    ctx.saveSettingsDebounced();
    
    let plotData = {
        version: '0.5.0',
        modules: { ...ep.modules },
        backstageHistory: {},
    };
    
    // Sync settings keys into store
    set('backstageActiveModeId', ep.backstageActiveModeId);
    set('backstageActiveThemeId', ep.backstageActiveThemeId);
    set('backstageAvatarOption', ep.backstageAvatarOption);
    set('backstageStorageScope', ep.backstageStorageScope);

    const chId = ctx.characterId;
    let oldCharBtsHistory = null;

    if (chId !== undefined && ctx.characters[chId]) {
        const charExtensions = ctx.characters[chId].data?.extensions;
        if (charExtensions && charExtensions.plot) {
            const migratedCharData = migrate(charExtensions.plot);
            if (migratedCharData.backstageHistory && Object.keys(migratedCharData.backstageHistory).length > 0) {
                oldCharBtsHistory = migratedCharData.backstageHistory;
            }
        }
    }
    
    const dbKey = getBtsDBKey();
    let backstageHistory = await getPlotValue(dbKey);

    let oldChatBtsHistory = null;
    if (ctx.chatMetadata) {
        if (!ctx.chatMetadata.plot) {
            ctx.chatMetadata.plot = {
                version: '0.5.0',
                backstageHistory: {},
            };
            ctx.saveMetadataDebounced();
        }
        
        const migratedChatData = migrate(ctx.chatMetadata.plot);
        if (migratedChatData.backstageHistory && Object.keys(migratedChatData.backstageHistory).length > 0) {
            oldChatBtsHistory = migratedChatData.backstageHistory;
        }
        ctx.saveMetadataDebounced();
    }

    // Auto-migration check for backstage history
    if (!backstageHistory || Object.keys(backstageHistory).length === 0) {
        backstageHistory = {};
        const activeModeId = get('backstageActiveModeId') || 'default';
        const modes = ep.backstageModes || [];
        const mode = modes.find(m => m.id === activeModeId) || { id: 'default', storageScope: 'chat' };
        const scope = mode.storageScope || 'chat';
        let migrated = false;
        
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
    
    if (!Array.isArray(backstageHistory)) {
        backstageHistory = [];
    }
    plotData.backstageHistory = backstageHistory;
    
    // Sync into store
    set('version', plotData.version);
    set('modules', plotData.modules);
    set('backstageHistory', plotData.backstageHistory);
    set('backstageHistoryLoadedKey', dbKey);
    set('isLoading', false);
}

export async function savePlotData() {
    const ctx = getContext();
    const ep = extension_settings.plot;
    if (!ep) return;

    // 1. Save global settings
    ep.modules = get('modules') || {};
    ep.backstageActiveModeId = get('backstageActiveModeId') || 'default';
    ep.backstageActiveThemeId = get('backstageActiveThemeId') || 'default';
    ep.backstageAvatarOption = get('backstageAvatarOption') || 'show-frame';
    ep.backstageStorageScope = get('backstageStorageScope') || 'chat';
    ctx.saveSettingsDebounced();

    // 2. Keep chatMetadata clean of actual history/data
    if (ctx.chatMetadata) {
        ctx.chatMetadata.plot = {
            version: get('version') || '0.5.0',
            backstageHistory: {},
        };
        ctx.saveMetadataDebounced();
    }

    // 3. Save backstageHistory for current active mode and active thread to IndexedDB
    const dbKey = getBtsDBKey();
    const loadedKey = get('backstageHistoryLoadedKey');
    if (loadedKey === dbKey) {
        const history = get('backstageHistory') || [];
        await savePlotValue(dbKey, history);
    } else {
        console.log(`[Plot Storage] Skipping backstage history save to key "${dbKey}" because loadedKey is "${loadedKey}"`);
    }


}

export function exportPlotData() {
    const data = {
        version: get('version') || '0.5.0',
        backstageHistory: get('backstageHistory') || [],
    };
    return JSON.stringify(data, null, 2);
}

export async function importPlotData(jsonString) {
    try {
        const rawData = JSON.parse(jsonString);
        const migratedData = migrate(rawData);
        
        set('version', migratedData.version);
        if (Array.isArray(migratedData.backstageHistory)) {
            set('backstageHistory', migratedData.backstageHistory);
        }
        
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
        version: '0.5.0',
        modules: {
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
        presets: {
            backstage: { 'default': { name: '默认预设' } },
        },
        currentPreset: {
            backstage: 'default'
        },
        streamModules: {
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
            version: '0.5.0',
            backstageHistory: {},
        };
    }
    
    // 5. Reset store keys
    set('version', '0.5.0');
    set('modules', extension_settings.plot.modules);
    set('backstageHistory', []);
    set('backstageActiveModeId', 'default');
    set('backstageActiveThemeId', 'default');
    set('backstageAvatarOption', 'show-frame');
    set('backstageStorageScope', 'chat');
    
    if (ctx.chatMetadata) {
        await ctx.saveMetadata();
    }
    await saveSettings();
}
