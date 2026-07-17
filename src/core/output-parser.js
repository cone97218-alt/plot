/**
 * output-parser.js - Main chat AI reply parser (Path C)
 *
 * Scans each incoming AI message for:
 *   1. JSON block extraction  → ```json { "plot": {...} } ``` or bare JSON
 *   2. Keyword mappings       → e.g. "好感+5" → relationship += 5
 *   3. User-defined regex     → extract data into specified store fields
 *
 * After update: dispatches a custom event so Tab badges can show change indicators.
 */

import { get, set } from './store.js';
import { savePlotData } from './storage.js';
import { extension_settings } from '../../../../../extensions.js';

const MODULE_NAME = 'plot';

/** Dispatch a DOM event so the panel UI can react (e.g. badge update) */
function dispatchPlotUpdate(changed) {
    document.dispatchEvent(new CustomEvent('plot:storeUpdated', { detail: { changed } }));
}

// ── 1. JSON Block Extraction ───────────────────────────────────────────────────

/**
 * Attempt to extract and apply a Plot JSON block from AI message text.
 * Supports two formats:
 *   A) ```json { "plot": { "variables": {...}, "goals": {...} } } ```
 *   B) Raw JSON object at root level with "plot" key
 *
 * @param {string} text
 * @returns {boolean} Whether any update was applied
 */
export function applyJsonBlock(text) {
    if (!text) return false;

    // Try to extract ```json ... ``` block first
    const fencedMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    let jsonStr = fencedMatch ? fencedMatch[1] : null;

    // B5 Fix: Fallback — find a JSON object containing a "plot" key using bracket-depth matching.
    // The old regex /[^{}]*"plot"/ broke when other keys with nested objects appeared before "plot".
    if (!jsonStr) {
        const plotKeyIdx = text.indexOf('"plot"');
        if (plotKeyIdx !== -1) {
            // Walk backwards from the "plot" key to find the start of the containing object
            let start = plotKeyIdx;
            let depth = 0;
            while (start >= 0) {
                if (text[start] === '}') depth++;
                if (text[start] === '{') {
                    if (depth === 0) break;
                    depth--;
                }
                start--;
            }
            if (start >= 0) {
                // Walk forward to find the matching closing brace
                depth = 0;
                let end = start;
                while (end < text.length) {
                    if (text[end] === '{') depth++;
                    if (text[end] === '}') {
                        depth--;
                        if (depth === 0) break;
                    }
                    end++;
                }
                if (depth === 0) {
                    jsonStr = text.slice(start, end + 1);
                }
            }
        }
    }

    if (!jsonStr) return false;

    try {
        const parsed = JSON.parse(jsonStr);
        const plotData = parsed.plot || parsed; // allow both { plot: {...} } and direct {...}
        let changed = false;

        if (plotData.variables && typeof plotData.variables === 'object') {
            const current = { ...(get('variables') || {}) };
            for (const [key, val] of Object.entries(plotData.variables)) {
                if (current[key] !== undefined && typeof current[key] === 'object') {
                    current[key] = { ...current[key], value: val };
                } else {
                    current[key] = val;
                }
            }
            set('variables', current);
            changed = true;
        }

        if (plotData.goals && typeof plotData.goals === 'object') {
            const current = { ...(get('goals') || {}) };
            // Support { completed: ["goal_id1", ...] } format
            if (Array.isArray(plotData.goals.completed)) {
                for (const id of plotData.goals.completed) {
                    if (current[id]) current[id].status = 'complete';
                }
            } else {
                // Support direct { goal_id: { status: "complete" } } format
                for (const [id, data] of Object.entries(plotData.goals)) {
                    if (current[id]) current[id] = { ...current[id], ...data };
                }
            }
            set('goals', current);
            changed = true;
        }

        if (changed) {
            savePlotData();
            dispatchPlotUpdate({ source: 'json_block' });
        }
        return changed;
    } catch (e) {
        console.warn('[Plot OutputParser] JSON block parse error:', e);
        return false;
    }
}

// ── 2. Keyword Mappings ────────────────────────────────────────────────────────

/**
 * Apply keyword-based variable mutations (e.g. "好感+5" → relationship += 5).
 * Mapping rules are stored in extension_settings.plot.keywordMappings:
 *   [{ keyword: "好感", variable: "relationship", op: "add", value: 5 }, ...]
 *
 * @param {string} text
 * @returns {boolean} Whether any update was applied
 */
export function applyKeywordMappings(text) {
    if (!text) return false;
    const s = extension_settings[MODULE_NAME] || {};
    const mappings = s.keywordMappings || [];
    if (mappings.length === 0) return false;

    const vars = { ...(get('variables') || {}) };
    let changed = false;

    for (const mapping of mappings) {
        if (!mapping.keyword || !mapping.variable) continue;
        if (!text.includes(mapping.keyword)) continue;

        const varEntry = vars[mapping.variable];
        const currentVal = typeof varEntry === 'object' ? (varEntry.value ?? 0) : (varEntry ?? 0);
        const delta = Number(mapping.value) || 0;
        let newVal;

        switch (mapping.op) {
            case 'add':     newVal = Number(currentVal) + delta; break;
            case 'sub':     newVal = Number(currentVal) - delta; break;
            case 'set':     newVal = delta; break;
            case 'toggle':  newVal = !currentVal; break;
            default:        newVal = Number(currentVal) + delta;
        }

        // Clamp if min/max defined
        if (typeof varEntry === 'object') {
            if (varEntry.min !== undefined) newVal = Math.max(varEntry.min, newVal);
            if (varEntry.max !== undefined) newVal = Math.min(varEntry.max, newVal);
            vars[mapping.variable] = { ...varEntry, value: newVal };
        } else {
            vars[mapping.variable] = newVal;
        }

        changed = true;
        console.log(`[Plot OutputParser] Keyword "${mapping.keyword}" → ${mapping.variable} ${mapping.op} ${delta} = ${newVal}`);
    }

    if (changed) {
        set('variables', vars);
        savePlotData();
        dispatchPlotUpdate({ source: 'keyword' });
    }
    return changed;
}

// ── 3. User-Defined Regex Rules ────────────────────────────────────────────────

/**
 * Apply user-defined regex extraction rules to the AI message.
 * Rules are stored in extension_settings.plot.outputRegexRules:
 *   [{ pattern: "\\[VAR:(\\w+)=(\\d+)\\]", variable: "$1", valueGroup: 2 }, ...]
 *
 * @param {string} text
 * @returns {boolean} Whether any update was applied
 */
export function applyRegexRules(text) {
    if (!text) return false;
    const s = extension_settings[MODULE_NAME] || {};
    const rules = s.outputRegexRules || [];
    if (rules.length === 0) return false;

    const vars = { ...(get('variables') || {}) };
    let changed = false;

    for (const rule of rules) {
        if (!rule.pattern || rule.disabled) continue;
        try {
            const regex = new RegExp(rule.pattern, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                // variable name can be a literal string or a capture group reference like "$1"
                let varName = rule.variable || '';
                if (varName.startsWith('$')) {
                    const groupIdx = parseInt(varName.slice(1), 10);
                    varName = match[groupIdx] || '';
                }
                // value comes from a capture group index
                const valGroupIdx = rule.valueGroup !== undefined ? Number(rule.valueGroup) : 0;
                const rawVal = match[valGroupIdx] || '';
                const numVal = parseFloat(rawVal);
                const finalVal = isNaN(numVal) ? rawVal : numVal;

                if (varName && vars[varName] !== undefined) {
                    if (typeof vars[varName] === 'object') {
                        vars[varName] = { ...vars[varName], value: finalVal };
                    } else {
                        vars[varName] = finalVal;
                    }
                    changed = true;
                }
            }
        } catch (e) {
            console.warn(`[Plot OutputParser] Regex rule error (pattern: "${rule.pattern}"):`, e);
        }
    }

    if (changed) {
        set('variables', vars);
        savePlotData();
        dispatchPlotUpdate({ source: 'regex' });
    }
    return changed;
}

// ── Main Entry ─────────────────────────────────────────────────────────────────

/**
 * Parse a received AI message through all three detection pipelines in sequence.
 * Called from hooks.js on MESSAGE_RECEIVED.
 *
 * @param {string} messageText
 */
export function parseMessage(messageText) {
    if (!messageText) return;

    const s = extension_settings[MODULE_NAME] || {};
    // Guard: only parse if output parsing is enabled
    if (s.outputParsingEnabled === false) return;

    // Pipeline order: JSON block (most precise) → keywords → regex
    const jsonHit     = applyJsonBlock(messageText);
    const keywordHit  = applyKeywordMappings(messageText);
    const regexHit    = applyRegexRules(messageText);

    if (jsonHit || keywordHit || regexHit) {
        console.log('[Plot OutputParser] Message parsed. Changes:', { jsonHit, keywordHit, regexHit });
    }
}
