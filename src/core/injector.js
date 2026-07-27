/**
 * injector.js - StoryPlan One-Time Chat Input (<request:...>) Injector
 *
 * Provides single-action injection into SillyTavern's #send_textarea.
 * When the user clicks the ⚡ bolt icon on any card/node, its guidance is
 * immediately formatted into <request:...> and written into the chat input,
 * without persisting any sticky/long-term selected state.
 */

import { extension_settings } from '../../../../../extensions.js';

// Default prefix and suffix
export const DEFAULT_INJECT_PREFIX = `<request:\n[系统剧情指引 / Plot Directive]\n在接下来的回复中，请自然地在表演与对话中引导并隐蔽推进以下选定的剧情指引：\n\n`;
export const DEFAULT_INJECT_SUFFIX = `\n>\n`;

export function injectSingleItemToChatInput(itemData, itemType) {
    try {
        if (!itemData) return false;

        let directiveContent = '';

        if (itemType === 'event') {
            const type    = itemData.type || '明线';
            const time    = itemData.time_slot || '全天';
            const title   = itemData.title || '未命名事件';
            const loc     = itemData.location ? ` @ ${itemData.location}` : '';
            const content = itemData.content ? `: ${itemData.content}` : '';
            directiveContent = `【事件日程指引】\n  * [${type}·${time}] ${title}${loc}${content}`;
        } else if (itemType === 'thread') {
            const title    = itemData.title || '未命名故事线';
            const status   = itemData.status || '发酵';
            const cat      = itemData.category || '主线';
            const tension  = itemData.tension !== undefined ? ` (张力:${itemData.tension}%)` : '';
            const desc     = itemData.desc ? ` - 进展: ${itemData.desc}` : '';
            const nextBeat = itemData.next_beat ? ` [契机: ${itemData.next_beat}]` : '';
            directiveContent = `【故事脉络指引】\n  * [${cat}·${status}] ${title}${tension}${desc}${nextBeat}`;
        } else if (itemType === 'node') {
            const indexStr = itemData.index || '目标';
            const beat     = itemData.beat || '未命名节点';
            const scene    = itemData.scene || '';
            const subtext  = itemData.subtext || '';
            const think    = itemData.think || '';
            const branches = Array.isArray(itemData.branches) ? itemData.branches.join(' / ') : (itemData.branches || '');

            let block = `  * [大纲节点 ${indexStr}] ${beat}`;
            if (scene)    block += `\n    - 画面描写: ${scene}`;
            if (subtext)  block += `\n    - 潜台词/内情: ${subtext}`;
            if (think)    block += `\n    - 叙事推进: ${think}`;
            if (branches) block += `\n    - 抉择分支: ${branches}`;
            directiveContent = `【大纲节点指引】\n${block}`;
        }

        if (!directiveContent) return false;

        const s = extension_settings.plot || {};
        const prefix = s.injectPrefix !== undefined ? s.injectPrefix : DEFAULT_INJECT_PREFIX;
        const suffix = s.injectSuffix !== undefined ? s.injectSuffix : DEFAULT_INJECT_SUFFIX;

        const formattedRequest = prefix + directiveContent + suffix;

        const textarea = document.getElementById('send_textarea');
        if (!textarea) {
            console.warn('[Plot Injector] #send_textarea element not found.');
            return false;
        }

        let currentVal = textarea.value || '';
        // Match existing <request:...> block or customized prefix/suffix block at start of input
        const requestRegex = /^<request:[\s\S]*?>\n*/i;

        if (requestRegex.test(currentVal)) {
            textarea.value = currentVal.replace(requestRegex, formattedRequest);
        } else {
            textarea.value = formattedRequest + (currentVal ? currentVal.trimStart() : '');
        }

        // Trigger input event for SillyTavern UI auto-resize
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        console.log('[Plot Injector] Single-item injected to #send_textarea:', directiveContent);
        return true;
    } catch (err) {
        console.error('[Plot Injector] Error performing single-item injection:', err);
        return false;
    }
}

export function registerStoryPlanInjector(eventSource, eventTypes) {
    // Pure one-time trigger action
}
