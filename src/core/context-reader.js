/**
 * context-reader.js - Advanced Content Reading Strategy Engine
 * Fetches and filters character info, user persona, world info entries (standard & custom), 
 * chat history (filtered by multi-rule regex), and external summary JS expressions.
 */

import { getContext, extension_settings } from '../../../../../extensions.js';
import { selected_world_info, loadWorldInfo } from '../../../../../world-info.js';
import { get } from './store.js';

const MODULE_NAME = 'plot';

function getReadingSettings() {
    if (!extension_settings.plot) {
        extension_settings.plot = {};
    }
    if (!extension_settings.plot.reading) {
        extension_settings.plot.reading = {
            historyLimit: 20,
            regexRules: [],              // { id, name, find, replace, disabled }
            injectCharacterDescription: true,
            injectUserDescription: true,
            injectCharacterLorebook: true,
            injectGlobalLorebook: true,
            injectChatLorebook: true,
            lorebookExcludePrefixes: '',
            lorebookIncludeFilter: '',
            customLorebookName: '',
            manuallySelectedEntries: [], // "worldBookName:entryUid" strings
            summaryJsExpression: ''
        };
    }

    const r = extension_settings.plot.reading;

    // Type guards: ensure arrays exist (backward-compat field renames run via migrator.js v0.5.0)
    r.regexRules             = r.regexRules             || [];
    r.manuallySelectedEntries = r.manuallySelectedEntries || [];

    return r;
}

export function getRecentMessages(limit = 20) {
    const ctx = getContext();
    const chat = ctx.chat || [];
    if (limit <= 0) {
        return [...chat];
    }
    return chat.slice(-limit);
}

export function applyRegexFilter(text, rules = []) {
    if (!text || !rules || rules.length === 0) return text;
    let filteredText = text;
    for (const rule of rules) {
        if (rule.disabled || !rule.find) continue;
        try {
            let regex;
            const findStr = rule.find;
            // Support regex modifiers if wrapped in /pattern/modifiers, otherwise default to global matching
            if (findStr.startsWith('/') && findStr.lastIndexOf('/') > 0) {
                const lastSlashIdx = findStr.lastIndexOf('/');
                const pattern = findStr.slice(1, lastSlashIdx);
                const flags = findStr.slice(lastSlashIdx + 1);
                regex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
            } else {
                regex = new RegExp(findStr, 'g');
            }
            const replaceStr = rule.replace || '';
            filteredText = filteredText.replace(regex, replaceStr);
        } catch (err) {
            console.warn(`[Plot] Invalid regex rule pattern: "${rule.find}":`, err);
        }
    }
    return filteredText;
}

export function fetchExternalSummary(expression) {
    if (!expression || !expression.trim()) return '';
    try {
        // Safe evaluation stub within a function context
        const fn = new Function('extension_settings', 'window', `
            try {
                return ${expression};
            } catch (e) {
                return '';
            }
        `);
        const result = fn(extension_settings, window);
        return result !== undefined && result !== null ? String(result) : '';
    } catch (err) {
        console.warn(`[Plot] Failed to evaluate summary expression: "${expression}":`, err);
        return '';
    }
}

export async function fetchWorldBookContent(opts = {}) {
    const ctx = getContext();

    const injectCharBook = opts.injectCharacterLorebook !== false;
    const injectGlobal = opts.injectGlobalLorebook !== false;
    const injectChat = opts.injectChatLorebook !== false;
    const excludePrefixes = opts.lorebookExcludePrefixes || '';
    const includeFilter = opts.lorebookIncludeFilter || '';
    const customLorebookName = opts.customLorebookName || '';
    const manuallySelectedEntries = opts.manuallySelectedEntries || [];

    const loadWorldInfoFn = loadWorldInfo || ctx.loadWorldInfo;
    if (!loadWorldInfoFn) {
        console.warn('[Plot WI] loadWorldInfo is not available!');
        return { before: '', after: '', depth: '' };
    }

    const booksToProcess = [];

    // 1. Character Lorebook
    const char = ctx.characters?.[ctx.characterId];
    let charBookName = '';
    if (char) {
        const rawBook = char.data?.character_book || char.character_book;
        if (rawBook) {
            charBookName = rawBook.name || `${char.name}'s Lorebook`;
        }
    }
    if (injectCharBook && charBookName) {
        booksToProcess.push(charBookName);
    }

    // 2. Global Lorebooks
    const globalBooks = Array.isArray(selected_world_info) ? selected_world_info : [];
    if (injectGlobal && globalBooks.length > 0) {
        booksToProcess.push(...globalBooks);
    }

    // 3. Chat Lorebook
    const chatBookName = ctx.chatMetadata?.world_info || '';
    if (injectChat && chatBookName) {
        booksToProcess.push(chatBookName);
    }

    // 4. Custom Lorebook
    if (customLorebookName) {
        booksToProcess.push(customLorebookName);
    }

    // Deduplicate book names
    const uniqueBooks = Array.from(new Set(booksToProcess));
    const finalEntriesList = [];

    // Helper to get entries for a single book
    const getEntriesForBook = async (bookName) => {
        try {
            const bookData = await loadWorldInfoFn(bookName);
            if (!bookData || !bookData.entries) {
                return [];
            }

            const allEntries = Object.values(bookData.entries);
            const prefix = bookName + ':';
            
            // Check if the user enabled "Configure entries individually" for this book
            const indKey = bookName + ':__individual__';
            const isIndividualEnabled = manuallySelectedEntries.includes(indKey);

            if (isIndividualEnabled) {
                // Only return the manually selected entries (filtering out the indKey itself)
                const uids = manuallySelectedEntries
                    .filter(key => key.startsWith(prefix) && key !== indKey)
                    .map(key => Number(key.slice(prefix.length)));
                const filtered = allEntries.filter(e => uids.includes(Number(e.uid)));
                return filtered;
            } else {
                // Return all entries in this book
                return allEntries;
            }
        } catch (err) {
            console.error(`[Plot] Failed to load entries for book "${bookName}":`, err);
            return [];
        }
    };

    // Load entries in parallel
    const entriesLists = await Promise.all(uniqueBooks.map(bookName => 
        getEntriesForBook(bookName).then(entries => entries.map(e => ({ ...e, world: bookName })))
    ));

    // Exclude and Include filters
    const exPrefixes = excludePrefixes.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    const incFilters = includeFilter.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);

    for (const list of entriesLists) {
        for (const entry of list) {
            const entryName = (entry.comment || '').toLowerCase();

            // Apply exclude name/prefix check
            if (exPrefixes.some(pref => entryName.startsWith(pref))) {
                continue;
            }

            // Apply include name/prefix check (if specified)
            if (incFilters.length > 0 && !incFilters.some(pref => entryName.startsWith(pref))) {
                continue;
            }

            // Avoid duplicates
            const isDup = finalEntriesList.some(e => Number(e.uid) === Number(entry.uid) && e.world === entry.world);
            if (!isDup) {
                finalEntriesList.push({
                    world: entry.world,
                    uid: entry.uid,
                    comment: entry.comment,
                    key: entry.key,
                    content: entry.content,
                    position: entry.position
                });
            }
        }
    }

    // Separate entries by position
    const beforeEntries = [];
    const afterEntries = [];
    const depthEntries = [];

    for (const e of finalEntriesList) {
        let posNum = -1;
        if (e.position !== undefined && e.position !== null) {
            if (typeof e.position === 'number') {
                posNum = e.position;
            } else {
                const posStr = String(e.position).toLowerCase();
                if (posStr === 'before_char') {
                    posNum = 0;
                } else if (posStr === 'after_char') {
                    posNum = 1;
                } else if (posStr === 'an_top') {
                    posNum = 2;
                } else if (posStr === 'an_bottom') {
                    posNum = 3;
                } else if (posStr === 'at_depth') {
                    posNum = 4;
                } else {
                    const parsed = Number(e.position);
                    posNum = isNaN(parsed) ? -1 : parsed;
                }
            }
        }

        if (posNum === 0) {
            beforeEntries.push(e);
        } else if (posNum === 4) {
            depthEntries.push(e);
        } else {
            afterEntries.push(e);
        }
    }

    const beforeResult = beforeEntries.map(e => e.content).join('\n\n');
    const afterResult = afterEntries.map(e => e.content).join('\n\n');
    const depthResult = depthEntries.map(e => e.content).join('\n\n');

    return {
        before: beforeResult,
        after: afterResult,
        depth: depthResult
    };
}

export async function buildContext(overrides = {}) {
    const ctx = getContext();
    const config = { ...getReadingSettings(), ...overrides };

    // 1. Character Description
    let charDesc = '';
    if (config.injectCharacterDescription) {
        const char = ctx.characters?.[ctx.characterId];
        if (char) {
            const parts = [];
            const description = char.data?.description || char.description;
            const personality = char.data?.personality || char.personality;
            const scenario = char.data?.scenario || char.scenario;
            if (description) parts.push(description);
            if (personality) parts.push(personality);
            if (scenario) parts.push(`场景设定: ${scenario}`);
            charDesc = parts.join('\n');
        }
    }

    // 2. User Persona Description
    let userDesc = '';
    if (config.injectUserDescription) {
        userDesc = ctx.powerUserSettings?.persona_description || '';
    }

    // 3. World Book / Lorebook Content (Split by Position)
    // B13 Fix: only fetch lorebook if at least one injection option is enabled
    const needsLorebook = config.injectCharacterLorebook ||
                          config.injectGlobalLorebook ||
                          config.injectChatLorebook ||
                          config.customLorebookName;
    const wiContent = needsLorebook
        ? await fetchWorldBookContent(config)
        : { before: '', after: '', depth: '' };

    // 4. Chat History
    const recentMessages = getRecentMessages(config.historyLimit);
    const formattedMessages = recentMessages.map(msg => {
        const sender = msg.name || (msg.is_user ? 'User' : 'Assistant');
        // Clean each message body with multi-rule regex filters
        const cleanedText = applyRegexFilter(msg.mes || '', config.regexRules);
        return `${sender}: ${cleanedText}`;
    }).join('\n');

    // 5. External Summary
    const summaryText = fetchExternalSummary(config.summaryJsExpression);

    // 6. Backstage specific macros
    const backstageMessages = get('backstageHistory') || [];

    const lastUserMsg = backstageMessages.slice().reverse().find(m => m.role === 'user');
    const btsUserInput = lastUserMsg?.content || '';

    const btsChatHistory = backstageMessages.map(m => {
        const sender = m.sender || (m.role === 'user' ? 'User' : 'Assistant');
        const content = m.content || '';
        return `${sender}: ${content}`;
    }).join('\n');

    return {
        char_desc: charDesc,
        user_desc: userDesc,
        world_info: [wiContent.before, wiContent.after, wiContent.depth].filter(Boolean).join('\n\n'), // fallback for legacy {{world_info}}
        world_info_before: wiContent.before,
        world_info_after: wiContent.after,
        world_info_depth: wiContent.depth,
        chat_history: formattedMessages,
        summary: summaryText,
        backstage_user_input: btsUserInput,
        backstage_chat_history: btsChatHistory,
        bts_user_input: btsUserInput,
        bts_chat_history: btsChatHistory
    };
}
