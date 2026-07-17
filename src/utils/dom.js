/**
 * dom.js - Shared DOM utilities
 *
 * Provides reusable UI helpers that were previously duplicated across
 * tab-settings.js, tab-backstage.js and other UI files.
 */

// ── Accordion ─────────────────────────────────────────────────────────────────

/**
 * Wire up a click-based accordion: clicking `headerEl` toggles `bodyEl`
 * visibility and rotates the optional `iconEl`.
 *
 * @param {HTMLElement} headerEl - Clickable header element
 * @param {HTMLElement} bodyEl   - Content to show/hide
 * @param {HTMLElement} [iconEl] - Optional chevron icon element
 * @param {boolean}     [openByDefault=false]
 */
export function setupAccordion(headerEl, bodyEl, iconEl = null, openByDefault = false) {
    const applyState = (open) => {
        bodyEl.style.display = open ? 'block' : 'none';
        if (iconEl) {
            iconEl.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    };

    applyState(openByDefault);

    headerEl.addEventListener('click', () => {
        const isOpen = bodyEl.style.display !== 'none';
        applyState(!isOpen);
    });
}

// ── Tab switcher ──────────────────────────────────────────────────────────────

/**
 * Switch active tab and associated content pane.
 *
 * @param {NodeList|HTMLElement[]} tabBtns    - All tab button elements
 * @param {NodeList|HTMLElement[]} panelEls   - All panel elements
 * @param {string}                 activeTabId - dataset attribute name to match
 * @param {string}                 targetId    - ID value to activate
 */
export function switchTab(tabBtns, panelEls, activeTabId, targetId) {
    tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset[activeTabId] === targetId));
    panelEls.forEach(pane => {
        pane.style.display = pane.dataset[activeTabId] === targetId ? '' : 'none';
    });
}

// ── createElement helper ──────────────────────────────────────────────────────

/**
 * Create an element with optional className, id, attributes, and children.
 *
 * @param {string} tag
 * @param {{ className?: string, id?: string, attrs?: Object, style?: string, children?: (HTMLElement|string)[] }} [opts]
 * @returns {HTMLElement}
 */
export function createElement(tag, { className, id, attrs = {}, style, children = [] } = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (id) el.id = id;
    if (style) el.style.cssText = style;
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    children.forEach(child => {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof HTMLElement) {
            el.appendChild(child);
        }
    });
    return el;
}

// ── World Info entry checklist ────────────────────────────────────────────────

/**
 * Render a checklist of World Info entries for a given lorebook inside `targetEl`.
 * Handles async loading, empty states, and checkbox binding.
 *
 * Previously duplicated identically between tab-settings.js and tab-backstage.js.
 *
 * @param {HTMLElement} targetEl          - Container to render into
 * @param {string}      bookName          - Lorebook name (passed to loadWorldInfoFn)
 * @param {string}      bookTypeLabel     - Human-readable label (e.g. '角色书')
 * @param {string[]}    selectedKeys      - Array of currently selected "bookName:uid" keys
 * @param {Function}    loadWorldInfoFn   - ctx.loadWorldInfo(bookName) → Promise<{entries}>
 * @param {Function}    onToggle          - Callback(keyStr: string, checked: boolean)
 */
export async function renderBookChecklist(targetEl, bookName, bookTypeLabel, selectedKeys, loadWorldInfoFn, onToggle) {
    if (!bookName) {
        targetEl.innerHTML = '';
        return;
    }

    targetEl.innerHTML = `<div style="font-size:0.82em; color:var(--SmartThemeBodyColor); padding:4px;"><i class="fa-solid fa-spinner fa-spin"></i> 加载中...</div>`;

    try {
        const data = await loadWorldInfoFn(bookName);
        if (!data || !data.entries) {
            targetEl.innerHTML = `<div style="font-size:0.82em; color:var(--SmartThemeEmColor); padding:4px;">该世界书无有效条目。</div>`;
            return;
        }

        const entries = Object.values(data.entries);
        if (entries.length === 0) {
            targetEl.innerHTML = `<div style="font-size:0.82em; color:var(--SmartThemeEmColor); padding:4px;">该世界书无有效条目。</div>`;
            return;
        }

        const indKey = `${bookName}:__individual__`;
        const isIndividualEnabled = selectedKeys.includes(indKey);

        // Build the list HTML without keywords display
        const listItems = entries.map(e => {
            const uid = Number(e.uid);
            const name = e.comment || e.key?.[0] || '未命名条目';
            const keyStr = `${bookName}:${uid}`;
            const isChecked = selectedKeys.includes(keyStr);
            const tooltip = e.content.slice(0, 150).replace(/"/g, '&quot;');
            return `
                <label style="display:flex; align-items:center; gap:8px; font-size:0.85em; cursor:pointer;" title="${tooltip}" class="plot-wi-item">
                    <input type="checkbox" class="plot-wi-entry-chk" data-world="${bookName}" data-uid="${uid}" ${isChecked ? 'checked' : ''}>
                    <span style="font-weight:600; color:var(--SmartThemeBodyColor);">${name}</span>
                </label>
            `;
        }).join('');

        targetEl.innerHTML = `
            <div style="font-size:0.82em; font-weight:bold; color:var(--SmartThemeEmColor); margin-top:4px; margin-bottom:4px; display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%;">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;" title="${bookTypeLabel}: ${bookName}">${bookTypeLabel}: ${bookName}</span>
                <label style="display:flex; align-items:center; gap:4px; font-size:0.9em; font-weight:normal; cursor:pointer; margin:0; flex-shrink:0; white-space:nowrap;" class="plot-wi-ind-label">
                    <input type="checkbox" class="plot-wi-ind-chk" ${isIndividualEnabled ? 'checked' : ''}>
                    自选条目
                </label>
            </div>
            <div class="plot-wi-list-wrapper" style="border:1px solid var(--SmartThemeBorderColor); border-radius:4px; max-height:120px; overflow-y:auto; padding:6px; display:${isIndividualEnabled ? 'flex' : 'none'}; flex-direction:column; gap:4px; background:rgba(0,0,0,0.15); margin-bottom:6px;">
                ${listItems}
            </div>
        `;

        const indChk = targetEl.querySelector('.plot-wi-ind-chk');
        const listWrapper = targetEl.querySelector('.plot-wi-list-wrapper');

        // Bind main checkbox toggle for individual settings
        indChk.addEventListener('change', () => {
            const checked = indChk.checked;
            listWrapper.style.display = checked ? 'flex' : 'none';
            
            // Toggle the state
            onToggle(indKey, checked);

            if (!checked) {
                // If turning off individual selection, uncheck all entries for this book
                targetEl.querySelectorAll('.plot-wi-entry-chk').forEach(chk => {
                    if (chk.checked) {
                        chk.checked = false;
                        const world = chk.dataset.world;
                        const uid = Number(chk.dataset.uid);
                        onToggle(`${world}:${uid}`, false);
                    }
                });
            }
        });

        // Bind entry checkbox events
        targetEl.querySelectorAll('.plot-wi-entry-chk').forEach(chk => {
            chk.addEventListener('change', () => {
                const world = chk.dataset.world;
                const uid = Number(chk.dataset.uid);
                const keyStr = `${world}:${uid}`;
                onToggle(keyStr, chk.checked);
            });
        });

    } catch (err) {
        targetEl.innerHTML = `<div style="font-size:0.82em; color:var(--SmartThemeQuoteColor); padding:4px;">加载失败: ${err.message}</div>`;
    }
}

// ── WI refresh event subscription ────────────────────────────────────────────

/**
 * Subscribe to all World Info-related ST events and call `callback` (debounced
 * by 250 ms) whenever the relevant data might have changed.
 *
 * Previously duplicated identically between tab-settings.js and tab-backstage.js.
 *
 * @param {Object}   ctx       - SillyTavern context object
 * @param {Function} callback  - No-argument function to call on change
 * @returns {Function} unsubscribe - Call to remove all listeners
 */
export function subscribeWIRefresh(ctx, callback) {
    let timer = null;
    const debounced = () => {
        clearTimeout(timer);
        timer = setTimeout(callback, 250);
    };

    const events = [
        ctx.eventTypes?.CHARACTER_PAGE_LOADED,
        ctx.eventTypes?.CHARACTER_EDITED,
        ctx.eventTypes?.CHAT_CHANGED,
        ctx.eventTypes?.CHAT_LOADED,
        ctx.eventTypes?.WORLDINFO_SETTINGS_UPDATED,
        ctx.eventTypes?.WORLDINFO_UPDATED,
        ctx.eventTypes?.SETTINGS_UPDATED,
    ].filter(Boolean);

    events.forEach(evt => ctx.eventSource.on(evt, debounced));

    return () => events.forEach(evt => ctx.eventSource.removeListener(evt, debounced));
}
