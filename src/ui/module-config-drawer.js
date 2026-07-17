/**
 * module-config-drawer.js - Reusable Configuration Drawer Component
 * Handles multiple modes per module (presetId, custom API connection, custom reading strategy).
 * Active mode ID is saved per-chat session. Modes are saved globally.
 */

import { getContext, extension_settings } from '../../../../../extensions.js';
import { loadWorldInfo } from '../../../../../world-info.js';
import { listConnections } from '../core/api-client.js';
import { getPlotValue, savePlotValue } from '../core/indexeddb.js';
import { renderBookChecklist, setupAccordion } from '../utils/dom.js';

// Helper to escape HTML safely
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Get all modes for a module (saved in global settings)
 * @param {string} moduleId
 * @returns {Array<Object>}
 */
export function getModuleModes(moduleId) {
    const ctx = getContext();
    if (!ctx.extensionSettings.plot) {
        ctx.extensionSettings.plot = {};
    }
    const key = `${moduleId}Modes`;
    if (!ctx.extensionSettings.plot[key]) {
        ctx.extensionSettings.plot[key] = [
            {
                id: 'default',
                name: '默认模式',
                presetId: 'default',
                useCustomConnection: false,
                connectionId: 'default',
                useCustomReading: false,
                reading: {
                    historyLimit: 10,
                    injectCharacterDescription: true,
                    injectUserDescription: true,
                    injectCharacterLorebook: true,
                    injectChatLorebook: true,
                    injectGlobalLorebook: true,
                    lorebookExcludePrefixes: '',
                    lorebookIncludeFilter: '',
                    customLorebookName: '',
                    manuallySelectedEntries: [],
                    regexRules: [],
                    summaryJsExpression: ''
                }
            }
        ];
    } else {
        // Self-healing / Upgrade check
        ctx.extensionSettings.plot[key].forEach(m => {
            if (m.reading) {
                if (m.reading.limit !== undefined && m.reading.historyLimit === undefined) {
                    m.reading.historyLimit = m.reading.limit;
                }
                if (m.reading.historyLimit === undefined) m.reading.historyLimit = 10;
                if (m.reading.injectCharacterDescription === undefined) m.reading.injectCharacterDescription = true;
                if (m.reading.injectUserDescription === undefined) m.reading.injectUserDescription = true;
                if (m.reading.lorebookExcludePrefixes === undefined) m.reading.lorebookExcludePrefixes = '';
                if (m.reading.lorebookIncludeFilter === undefined) m.reading.lorebookIncludeFilter = '';
                if (m.reading.summaryJsExpression === undefined) m.reading.summaryJsExpression = '';
            }
        });
    }
    return ctx.extensionSettings.plot[key];
}

/**
 * Get active mode ID for this chat session
 * @param {string} moduleId
 * @returns {Promise<string>}
 */
export async function getActiveModeId(moduleId) {
    const ctx = getContext();
    const chId = ctx.characterId;
    const chatId = ctx.getCurrentChatId() || 'unknown';
    const key = `active_${moduleId}_mode_id_${chId}_${chatId}`;
    let modeId = await getPlotValue(key);
    if (!modeId) {
        modeId = 'default';
    }
    return modeId;
}

/**
 * Set active mode ID for this chat session
 * @param {string} moduleId
 * @param {string} modeId
 * @returns {Promise<void>}
 */
export async function setActiveModeId(moduleId, modeId) {
    const ctx = getContext();
    const chId = ctx.characterId;
    const chatId = ctx.getCurrentChatId() || 'unknown';
    const key = `active_${moduleId}_mode_id_${chId}_${chatId}`;
    await savePlotValue(key, modeId);
}

/**
 * Get active mode configuration for this chat session
 * @param {string} moduleId
 * @returns {Promise<Object>}
 */
export async function getActiveModeConfig(moduleId) {
    const modes = getModuleModes(moduleId);
    const activeId = await getActiveModeId(moduleId);
    let mode = modes.find(m => m.id === activeId);
    if (!mode) {
        mode = modes[0] || { id: 'default', name: '默认模式' };
    }
    if (!mode.reading) {
        mode.reading = {
            historyLimit: 10,
            injectCharacterDescription: true,
            injectUserDescription: true,
            injectCharacterLorebook: true,
            injectChatLorebook: true,
            injectGlobalLorebook: true,
            lorebookExcludePrefixes: '',
            lorebookIncludeFilter: '',
            customLorebookName: '',
            manuallySelectedEntries: [],
            regexRules: [],
            summaryJsExpression: ''
        };
    }
    return mode;
}

/**
 * Creates and mounts a configuration drawer inside containerEl.
 * @param {string} moduleId - e.g. 'goals', 'variables', 'storyline'
 * @param {HTMLElement} containerEl - Parent container where drawer will be mounted
 * @param {Function} onSave - Callback(newConfig) when save is successful
 * @returns {Object} { show: () => void, hide: () => void }
 */
export function createModuleConfigDrawer(moduleId, containerEl, onSave) {
    // 1. Create drawer DOM
    const drawer = document.createElement('div');
    drawer.className = 'plot-bts-drawer';
    drawer.style.cssText = `
        position: absolute;
        inset: 0;
        background-color: rgba(var(--SmartThemeBlurTintColor-rgb, 20,20,30), 1);
        z-index: 1000;
        display: none;
        flex-direction: column;
    `;
    
    drawer.innerHTML = `
        <div class="plot-bts-drawer-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid var(--SmartThemeBorderColor); background-color:var(--SmartThemeChatTintColor); flex-shrink:0;">
            <span class="plot-bts-drawer-title" style="font-weight:bold; color:var(--SmartThemeEmColor); font-size:0.95em;"><i class="fa-solid fa-sliders"></i> 配置模块选项</span>
            <i class="fa-solid fa-xmark plot-drawer-close-btn" style="cursor:pointer; font-size:1.3em; color:var(--SmartThemeEmColor); padding:4px;"></i>
        </div>
        <div class="plot-bts-drawer-body" style="flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:14px;">
            
            <!-- Mode Management -->
            <div class="plot-setting-group" style="display:flex; flex-direction:column; gap:8px; border-bottom:1px solid var(--SmartThemeBorderColor); padding-bottom:12px; flex-shrink:0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="plot-label" style="font-weight:bold; color:var(--SmartThemeEmColor);"><i class="fa-solid fa-folder-tree"></i> 模式管理</span>
                    <div style="display:flex; gap:6px;">
                        <button class="plot-drawer-mode-add-btn plot-btn" style="padding:2px 8px; font-size:0.8em; border-color:var(--SmartThemeEmColor); color:var(--SmartThemeEmColor);"><i class="fa-solid fa-plus"></i> 新建</button>
                        <button class="plot-drawer-mode-del-btn plot-btn" style="padding:2px 8px; font-size:0.8em; color:var(--SmartThemeQuoteColor); border-color:var(--SmartThemeQuoteColor);"><i class="fa-solid fa-trash"></i> 删除</button>
                    </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center; width:100%;">
                    <span style="font-size:0.85em; opacity:0.8; white-space:nowrap;">模式名称:</span>
                    <input type="text" class="plot-drawer-mode-name-input plot-input" style="flex:1; font-size:0.85em; padding:4px 8px;">
                </div>
            </div>

            <!-- Sub-tab bar for settings -->
            <div class="plot-sub-tab-bar" id="plot-drawer-tabs" style="margin-bottom: 10px; display: flex; gap: 4px; border-bottom: 1px solid var(--SmartThemeBorderColor); padding-bottom: 6px; flex-shrink: 0;">
                <button class="plot-sub-tab active" data-tab="general" style="padding: 4px 10px; font-size: 0.82em;"><i class="fa-solid fa-sliders"></i> 常规</button>
                <button class="plot-sub-tab" data-tab="reading" style="padding: 4px 10px; font-size: 0.82em;"><i class="fa-solid fa-book-open"></i> 读取</button>
                <button class="plot-sub-tab" data-tab="display" id="plot-drawer-tab-btn-display" style="display: none; padding: 4px 10px; font-size: 0.82em;"><i class="fa-solid fa-desktop"></i> 显示</button>
                <button class="plot-sub-tab" data-tab="injection" id="plot-drawer-tab-btn-inject" style="display: none; padding: 4px 10px; font-size: 0.82em;"><i class="fa-solid fa-message"></i> 注入</button>
            </div>

            <!-- Tab Content: General -->
            <div class="plot-drawer-tab-content" data-tab="general" style="display: flex; flex-direction: column; gap: 14px;">
                <!-- Presets -->
                <div class="plot-setting-group" id="plot-drawer-preset-group-single">
                    <label class="plot-label">绑定提示词预设</label>
                    <select class="plot-drawer-preset-select plot-select" style="width:100%;"></select>
                </div>
                
                <div class="plot-setting-group" id="plot-drawer-preset-group-split" style="display:none; flex-direction:column; gap:8px;">
                    <div>
                        <label class="plot-label">绑定目标判定预设</label>
                        <select class="plot-drawer-preset-eval-select plot-select" style="width:100%;"></select>
                    </div>
                    <div>
                        <label class="plot-label">绑定目标生成预设</label>
                        <select class="plot-drawer-preset-gen-select plot-select" style="width:100%;"></select>
                    </div>
                </div>
                
                <div style="font-size:0.75em; color:var(--SmartThemeEmColor); margin-top:-6px; margin-bottom: 10px;">
                    在顶部主菜单的“提示词”子页面中可配置该模块的预设卡片块。
                </div>

                <!-- Custom Connection -->
                <label style="display:flex; align-items:center; gap:8px; font-size:0.92em; font-weight:bold; cursor:pointer; padding-top:8px; padding-bottom:8px; border-top:1px solid var(--SmartThemeBorderColor); margin-top:5px;">
                    <input type="checkbox" class="plot-drawer-conn-toggle">
                    为此模式启用单独的 API 连接
                </label>
                <div class="plot-drawer-conn-container" style="display:none; flex-direction:column; gap:12px; margin-top:5px; margin-bottom:5px;">
                    <div class="plot-setting-group">
                        <select class="plot-drawer-connection-select plot-select" style="width:100%;"></select>
                    </div>
                </div>
            </div>

            <!-- Tab Content: Reading -->
            <div class="plot-drawer-tab-content" data-tab="reading" style="display: none; flex-direction: column; gap: 14px;">
                <!-- Custom Reading Strategy -->
                <label style="display:flex; align-items:center; gap:8px; font-size:0.92em; font-weight:bold; cursor:pointer; padding-bottom:8px; border-bottom:1px solid var(--SmartThemeBorderColor);">
                    <input type="checkbox" class="plot-drawer-read-toggle">
                    为此模式启用单独的内容读取策略
                </label>
                <div class="plot-drawer-read-container" style="display:none; flex-direction:column; gap:12px; margin-top:5px;">
                    <!-- Accordions -->
                    <div class="plot-accordion" style="border:1px solid var(--SmartThemeBorderColor); border-radius:6px; overflow:hidden;">
                        
                        <!-- Accordion 1: 对话历史 -->
                        <div class="plot-accordion-section">
                            <div class="plot-accordion-header plot-drawer-acc-hdr-history" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,0,0,0.05); border-bottom: none;">
                                <span class="plot-accordion-title" style="font-weight:600; font-size:0.88em;">对话历史</span>
                                <i class="fa-solid fa-chevron-down plot-accordion-icon" style="font-size:0.85em;"></i>
                            </div>
                            <div class="plot-accordion-body plot-drawer-acc-body-history" style="display:none; padding:12px; background:transparent;">
                                <div class="plot-setting-group" style="margin-bottom:12px;">
                                    <label class="plot-label">历史对话读取深度</label>
                                    <input type="number" class="plot-drawer-read-limit plot-input" min="0" style="width:100%;">
                                    <div style="font-size:0.72em; color:var(--SmartThemeEmColor); margin-top:2px;">最近的对话消息条数。设置为 0 时拉取全部。</div>
                                </div>
                                
                                <!-- 二级折叠条: 正则裁剪 -->
                                <div class="plot-accordion-section" style="border:1px solid var(--SmartThemeBorderColor); border-radius:4px; overflow:hidden; margin-top:10px;">
                                    <div class="plot-accordion-header plot-drawer-acc-hdr-regex" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(0,0,0,0.05);">
                                        <span class="plot-accordion-title" style="font-size:0.85em;">正则裁剪规则</span>
                                        <i class="fa-solid fa-chevron-down plot-accordion-icon" style="font-size:0.85em;"></i>
                                    </div>
                                    <div class="plot-accordion-body plot-drawer-acc-body-regex" style="display:none; padding:10px; background:transparent;">
                                        <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
                                            <button class="plot-drawer-regex-add-btn plot-btn" style="padding:2px 8px; font-size:0.8em;"><i class="fa-solid fa-plus"></i> 新建规则</button>
                                        </div>
                                        <div class="plot-drawer-regex-list" style="display:flex; flex-direction:column; gap:6px; max-height:150px; overflow-y:auto;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Accordion 2: 设定与描述 -->
                        <div class="plot-accordion-section" style="border-top:1px solid var(--SmartThemeBorderColor);">
                            <div class="plot-accordion-header plot-drawer-acc-hdr-persona" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,0,0,0.05);">
                                <span class="plot-accordion-title" style="font-weight:600; font-size:0.88em;">设定与描述</span>
                                <i class="fa-solid fa-chevron-down plot-accordion-icon" style="font-size:0.85em;"></i>
                            </div>
                            <div class="plot-accordion-body plot-drawer-acc-body-persona" style="display:none; padding:12px; background:transparent;">
                                <div style="display:flex; flex-direction:column; gap:8px;">
                                    <label style="display:flex; align-items:center; gap:6px; font-size:0.85em; cursor:pointer;">
                                        <input type="checkbox" class="plot-drawer-char-desc-chk"> 注入角色卡设定描述
                                    </label>
                                    <label style="display:flex; align-items:center; gap:6px; font-size:0.85em; cursor:pointer;">
                                        <input type="checkbox" class="plot-drawer-user-desc-chk"> 注入当前用户描述
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Accordion 3: 世界书设定 -->
                        <div class="plot-accordion-section" style="border-top:1px solid var(--SmartThemeBorderColor);">
                            <div class="plot-accordion-header plot-drawer-acc-hdr-lore" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,0,0,0.05);">
                                <span class="plot-accordion-title" style="font-weight:600; font-size:0.88em;">世界书设定</span>
                                <i class="fa-solid fa-chevron-down plot-accordion-icon" style="font-size:0.85em;"></i>
                            </div>
                            <div class="plot-accordion-body plot-drawer-acc-body-lore" style="display:none; padding:12px; flex-direction:column; gap:10px; background:transparent;">
                                <label style="display:flex; align-items:center; gap:6px; font-size:0.85em; cursor:pointer;">
                                    <input type="checkbox" class="plot-drawer-wi-char-chk"> 注入角色卡绑定的世界书
                                </label>
                                <label style="display:flex; align-items:center; gap:6px; font-size:0.85em; cursor:pointer;">
                                    <input type="checkbox" class="plot-drawer-wi-chat-chk"> 注入当前聊天绑定的独立世界书
                                </label>
                                <label style="display:flex; align-items:center; gap:6px; font-size:0.85em; cursor:pointer;">
                                    <input type="checkbox" class="plot-drawer-wi-global-chk"> 注入全局启用的世界书
                                </label>
                                
                                <div class="plot-setting-group" style="margin-top:6px; margin-bottom:8px;">
                                    <label class="plot-label" style="font-size:0.85em;">独立启用世界书</label>
                                    <select class="plot-drawer-wi-custom-select plot-select" style="width:100%;"></select>
                                </div>

                                <div style="border-top:1px solid var(--SmartThemeBorderColor); margin-top:8px; padding-top:8px;">
                                    <div style="font-size:0.82em; font-weight:bold; color:var(--SmartThemeEmColor); margin-bottom:6px;">自选白名单条目细化</div>
                                    <div class="plot-drawer-wi-char-container"></div>
                                    <div class="plot-drawer-wi-chat-container"></div>
                                    <div class="plot-drawer-wi-global-container" style="display:flex; flex-direction:column; gap:6px;"></div>
                                    <div class="plot-drawer-wi-custom-container"></div>
                                </div>

                                <!-- 全局过滤设置 -->
                                <div class="plot-accordion-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 4px; overflow: hidden; margin-top: 10px;">
                                    <div class="plot-accordion-header plot-drawer-acc-hdr-wi-filter" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:6px 12px; background:rgba(0,0,0,0.05);">
                                        <span class="plot-accordion-title" style="font-size:0.82em;">全局过滤设置</span>
                                        <i class="fa-solid fa-chevron-down plot-accordion-icon" style="font-size:0.82em;"></i>
                                    </div>
                                    <div class="plot-accordion-body plot-drawer-acc-body-wi-filter" style="display:none; padding:10px; background:transparent;">
                                        <div style="margin-bottom:8px;">
                                            <label class="plot-label" style="font-size:0.85em; font-weight:normal; margin-bottom:4px; display:block;">排除的世界书条目名称/前缀</label>
                                            <input type="text" class="plot-drawer-wi-exclude plot-input" placeholder="例如: system_, hidden_" style="width:100%;">
                                        </div>
                                        <div>
                                            <label class="plot-label" style="font-size:0.85em; font-weight:normal; margin-bottom:4px; display:block;">只注入匹配名称/前缀的条目</label>
                                            <input type="text" class="plot-drawer-wi-include plot-input" placeholder="例如: plot_, state_" style="width:100%;">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Accordion 4: 其他参数与JS表达式 -->
                        <div class="plot-accordion-section" style="border-top:1px solid var(--SmartThemeBorderColor);">
                            <div class="plot-accordion-header plot-drawer-acc-hdr-other" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,0,0,0.05);">
                                <span class="plot-accordion-title" style="font-weight:600; font-size:0.88em;">其他参数与JS表达式</span>
                                <i class="fa-solid fa-chevron-down plot-accordion-icon" style="font-size:0.85em;"></i>
                            </div>
                            <div class="plot-accordion-body plot-drawer-acc-body-other" style="display:none; padding:12px; background:transparent;">
                                <div class="plot-setting-group">
                                    <label class="plot-label">第三方总结数据获取 JS 表达式</label>
                                    <input type="text" class="plot-drawer-read-summary-expr plot-input" placeholder="例如: extension_settings.summarize?.summary" style="width:100%; font-family:monospace; font-size:0.9em;">
                                    <div style="font-size:0.75em; color:var(--SmartThemeEmColor); margin-top:4px;">
                                        高级功能：指定用于获取对话摘要的 JS 表达式。提取的数据将赋值给模板中的 {{summary}} 占位符。
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <!-- Tab Content: Display -->
            <div class="plot-drawer-tab-content" data-tab="display" style="display: none; flex-direction: column; gap: 14px;">
                <!-- Goals Display Fields Settings (Goals-specific) -->
                <div class="plot-setting-group" id="plot-goals-display-settings" style="border-top: none; padding-top: 0; margin-top: 0;">
                    <label class="plot-label">显示字段配置</label>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.85em; margin-top: 4px;">
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="checkbox" class="plot-drawer-display-desc-chk"> 显示任务描述
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="checkbox" class="plot-drawer-display-status-chk"> 显示任务状态
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="checkbox" class="plot-drawer-display-type-chk"> 显示分类徽章
                        </label>
                    </div>
                </div>
                
                <!-- Goals Custom Badges Settings (Goals-specific) -->
                <div class="plot-setting-group" id="plot-goals-badges-settings" style="border-top: 1px solid var(--SmartThemeBorderColor); padding-top: 8px; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label class="plot-label">自定义徽章映射与颜色</label>
                        <button id="plot-drawer-add-badge-rule-btn" class="menu_button plot-btn" style="padding: 1px 6px; font-size: 0.72em;"><i class="fa-solid fa-plus"></i> 添加徽章</button>
                    </div>
                    <div id="plot-drawer-badges-rules-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; padding: 4px; border: 1px dashed var(--SmartThemeBorderColor); border-radius: 4px; background: rgba(0,0,0,0.1);">
                        <!-- Badges rules list renders here -->
                    </div>
                </div>
            </div>

            <!-- Tab Content: Injection -->
            <div class="plot-drawer-tab-content" data-tab="injection" style="display: none; flex-direction: column; gap: 14px;">
                <!-- Goals Prompt Injection Settings (Goals-specific) -->
                <div class="plot-setting-group" id="plot-goals-injection-settings" style="border-top: none; padding-top: 0; margin-top: 0;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:0.92em; font-weight:bold; cursor:pointer; margin-bottom: 6px;">
                        <input type="checkbox" class="plot-drawer-inject-enabled-chk">
                        启用剧情目标详细注入到主聊天
                    </label>
                    <div class="plot-goals-inject-container" style="display: none; flex-direction: column; gap: 8px;">
                        <div>
                            <label class="plot-label" style="font-size: 0.85em;">主聊天注入大模板 (Prompt Template)</label>
                            <textarea class="plot-drawer-inject-template plot-input" rows="4" style="width:100%; font-size:0.85em; font-family: monospace; resize: vertical;" placeholder="例如:
当前任务:
{{plot_goals_active}}"></textarea>
                            <span class="plot-hint-text">支持宏: {{plot_goals_active}} (进行中), {{plot_goals_complete}} (已完成), {{plot_goals_failed}} (已失败), {{plot_goals_all}} (全部)</span>
                        </div>
                        <div>
                            <label class="plot-label" style="font-size: 0.85em;">默认行模板 (Default Line Template)</label>
                            <input type="text" class="plot-drawer-inject-line-template plot-input" style="width:100%; font-size:0.85em;" placeholder="【{{title}}】{{desc}}">
                            <span class="plot-hint-text">支持占位符: {{title}}, {{desc}} 以及自定义扩展属性名称。</span>
                        </div>
                    </div>
                </div>

                <!-- Variables Prompt Injection Settings (Variables-specific) -->
                <div class="plot-setting-group" id="plot-variables-injection-settings" style="border-top: none; padding-top: 0; margin-top: 0; display: none;">
                    <label style="display:flex; align-items:center; gap:8px; font-size:0.92em; font-weight:bold; cursor:pointer; margin-bottom: 6px;">
                        <input type="checkbox" class="plot-drawer-var-inject-enabled-chk">
                        启用变量世界状态详细注入到主聊天
                    </label>
                    <div class="plot-variables-inject-container" style="display: none; flex-direction: column; gap: 8px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:0.85em; cursor:pointer; margin-bottom: 4px;">
                            <input type="checkbox" class="plot-drawer-var-inject-all-chk">
                            同时注入被隐藏的变量 (默认仅注入可见变量)
                        </label>
                        <div>
                            <label class="plot-label" style="font-size: 0.85em;">主聊天注入大模板 (Prompt Template)</label>
                            <textarea class="plot-drawer-var-inject-template plot-input" rows="4" style="width:100%; font-size:0.85em; font-family: monospace; resize: vertical;" placeholder="例如:
当前状态:
{{plot_variables_visible}}"></textarea>
                            <span class="plot-hint-text">支持宏: {{plot_variables_visible}} (可见变量), {{plot_variables_hidden}} (隐藏变量), {{plot_variables_all}} (全部)</span>
                        </div>
                        <div>
                            <label class="plot-label" style="font-size: 0.85em;">默认行模板 (Default Line Template)</label>
                            <input type="text" class="plot-drawer-var-inject-line-template plot-input" style="width:100%; font-size:0.85em;" placeholder="- {{name}}: {{value}}">
                            <span class="plot-hint-text">支持占位符: {{name}}, {{id}}, {{value}}, {{value_tree}} (JSON树状展开), {{desc}}, {{type}}</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
        <div style="border-top:1px solid var(--SmartThemeBorderColor); padding:10px 14px; background-color:var(--SmartThemeChatTintColor); display:flex; justify-content:flex-end; gap:8px; flex-shrink:0;">
            <button class="plot-drawer-cancel-btn plot-btn" style="padding:6px 16px; font-size:0.9em;">取消</button>
            <button class="plot-drawer-save-btn plot-btn" style="padding:6px 16px; font-size:0.9em; background-color:var(--SmartThemeEmColor); color:var(--SmartThemeInputBgColor); font-weight:bold; border-color:var(--SmartThemeEmColor);">保存</button>
        </div>
    `;
    
    containerEl.appendChild(drawer);
    
    // ── 2. Local state & caching ──
    let currentModeId = 'default';
    let localConfig = null;
    let lorebookSelections = []; // list of selected "bookName:uid"
    let localRegexRules = [];
    
    const modeNameInput = drawer.querySelector('.plot-drawer-mode-name-input');
    const modeAddBtn = drawer.querySelector('.plot-drawer-mode-add-btn');
    const modeDelBtn = drawer.querySelector('.plot-drawer-mode-del-btn');
    
    const presetSelect = drawer.querySelector('.plot-drawer-preset-select');
    const presetEvalSelect = drawer.querySelector('.plot-drawer-preset-eval-select');
    const presetGenSelect = drawer.querySelector('.plot-drawer-preset-gen-select');
    const connToggle = drawer.querySelector('.plot-drawer-conn-toggle');
    const connContainer = drawer.querySelector('.plot-drawer-conn-container');
    const connSelect = drawer.querySelector('.plot-drawer-connection-select');
    const readToggle = drawer.querySelector('.plot-drawer-read-toggle');
    const readContainer = drawer.querySelector('.plot-drawer-read-container');
    const readLimit = drawer.querySelector('.plot-drawer-read-limit');
    
    const closeBtn = drawer.querySelector('.plot-drawer-close-btn');
    const cancelBtn = drawer.querySelector('.plot-drawer-cancel-btn');
    const saveBtn = drawer.querySelector('.plot-drawer-save-btn');
    
    // ── Tab switching logic ──
    const tabButtons = drawer.querySelectorAll('#plot-drawer-tabs .plot-sub-tab');
    const tabContents = drawer.querySelectorAll('.plot-drawer-tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const activeTab = btn.dataset.tab;
            tabContents.forEach(content => {
                content.style.display = content.dataset.tab === activeTab ? 'flex' : 'none';
            });
        });
    });
    
    // Accordion setup
    setupAccordion(drawer.querySelector('.plot-drawer-acc-hdr-history'), drawer.querySelector('.plot-drawer-acc-body-history'));
    setupAccordion(drawer.querySelector('.plot-drawer-acc-hdr-regex'), drawer.querySelector('.plot-drawer-acc-body-regex'));
    setupAccordion(drawer.querySelector('.plot-drawer-acc-hdr-persona'), drawer.querySelector('.plot-drawer-acc-body-persona'));
    setupAccordion(drawer.querySelector('.plot-drawer-acc-hdr-lore'), drawer.querySelector('.plot-drawer-acc-body-lore'));
    setupAccordion(drawer.querySelector('.plot-drawer-acc-hdr-wi-filter'), drawer.querySelector('.plot-drawer-acc-body-wi-filter'));
    setupAccordion(drawer.querySelector('.plot-drawer-acc-hdr-other'), drawer.querySelector('.plot-drawer-acc-body-other'));
    
    // ── Toggle visibility listeners ──
    connToggle.addEventListener('change', () => {
        connContainer.style.display = connToggle.checked ? 'flex' : 'none';
    });
    readToggle.addEventListener('change', () => {
        readContainer.style.display = readToggle.checked ? 'flex' : 'none';
    });
    
    // Toggle for goals injection setting
    const goalsInjectChk = drawer.querySelector('.plot-drawer-inject-enabled-chk');
    const goalsInjectContainer = drawer.querySelector('.plot-goals-inject-container');
    if (goalsInjectChk && goalsInjectContainer) {
        goalsInjectChk.addEventListener('change', () => {
            goalsInjectContainer.style.display = goalsInjectChk.checked ? 'flex' : 'none';
        });
    }

    // Toggle for variables injection setting
    const varsInjectChk = drawer.querySelector('.plot-drawer-var-inject-enabled-chk');
    const varsInjectContainer = drawer.querySelector('.plot-variables-inject-container');
    if (varsInjectChk && varsInjectContainer) {
        varsInjectChk.addEventListener('change', () => {
            varsInjectContainer.style.display = varsInjectChk.checked ? 'flex' : 'none';
        });
    }
    
    // Cancel / Close
    const hide = () => {
        drawer.classList.remove('show');
        setTimeout(() => { drawer.style.display = 'none'; }, 200);
    };
    closeBtn.addEventListener('click', hide);
    cancelBtn.addEventListener('click', hide);
    
    // ── Mode Management Actions ──
    modeAddBtn.addEventListener('click', async () => {
        const name = prompt('请输入新模式名称:');
        if (!name || !name.trim()) return;
        
        const modes = getModuleModes(moduleId);
        const id = 'mode_' + Date.now();
        const newMode = {
            id,
            name: name.trim(),
            presetId: 'default',
            useCustomConnection: false,
            connectionId: 'default',
            useCustomReading: false,
            reading: {
                historyLimit: 10,
                injectCharacterDescription: true,
                injectUserDescription: true,
                injectCharacterLorebook: true,
                injectChatLorebook: true,
                injectGlobalLorebook: true,
                lorebookExcludePrefixes: '',
                lorebookIncludeFilter: '',
                customLorebookName: '',
                manuallySelectedEntries: [],
                regexRules: [],
                summaryJsExpression: ''
            }
        };
        
        modes.push(newMode);
        getContext().extensionSettings.plot[`${moduleId}Modes`] = modes;
        
        await setActiveModeId(moduleId, id);
        await show();
    });
    
    modeDelBtn.addEventListener('click', async () => {
        const modes = getModuleModes(moduleId);
        if (modes.length <= 1) {
            alert('至少需要保留一个模式，无法删除最后一个模式。');
            return;
        }
        
        if (confirm(`确定要删除当前模式【${modeNameInput.value}】吗？`)) {
            const updated = modes.filter(m => m.id !== currentModeId);
            getContext().extensionSettings.plot[`${moduleId}Modes`] = updated;
            
            await setActiveModeId(moduleId, updated[0].id);
            await show();
        }
    });
    
    // Save
    saveBtn.addEventListener('click', async () => {
        const modes = getModuleModes(moduleId);
        const mode = modes.find(m => m.id === currentModeId);
        if (!mode) return;
        
        mode.name = modeNameInput.value.trim() || '未命名模式';
        if (moduleId === 'goals') {
            mode.presetId = presetEvalSelect.value;
            mode.generationPresetId = presetGenSelect.value;
        } else {
            mode.presetId = presetSelect.value;
        }
        mode.useCustomConnection = connToggle.checked;
        mode.connectionId = connSelect.value;
        mode.useCustomReading = readToggle.checked;
        
        mode.reading.historyLimit = Number(readLimit.value) || 0;
        delete mode.reading.limit;
        mode.reading.injectCharacterDescription = drawer.querySelector('.plot-drawer-char-desc-chk').checked;
        mode.reading.injectUserDescription = drawer.querySelector('.plot-drawer-user-desc-chk').checked;
        mode.reading.injectCharacterLorebook = drawer.querySelector('.plot-drawer-wi-char-chk').checked;
        mode.reading.injectChatLorebook = drawer.querySelector('.plot-drawer-wi-chat-chk').checked;
        mode.reading.injectGlobalLorebook = drawer.querySelector('.plot-drawer-wi-global-chk').checked;
        mode.reading.lorebookExcludePrefixes = drawer.querySelector('.plot-drawer-wi-exclude').value.trim();
        mode.reading.lorebookIncludeFilter = drawer.querySelector('.plot-drawer-wi-include').value.trim();
        mode.reading.customLorebookName = drawer.querySelector('.plot-drawer-wi-custom-select').value;
        mode.reading.manuallySelectedEntries = [...lorebookSelections];
        mode.reading.regexRules = [...localRegexRules];
        mode.reading.summaryJsExpression = drawer.querySelector('.plot-drawer-read-summary-expr').value.trim();
        
        if (moduleId === 'goals') {
            mode.display = {
                showDesc: drawer.querySelector('.plot-drawer-display-desc-chk').checked,
                showStatus: drawer.querySelector('.plot-drawer-display-status-chk').checked,
                showType: drawer.querySelector('.plot-drawer-display-type-chk').checked
            };
            
            // Save badges
            const finalBadges = {};
            drawer.querySelectorAll('#plot-drawer-badges-rules-list .plot-badge-rule-row').forEach(row => {
                const key = row.querySelector('.badge-key').value.trim();
                const label = row.querySelector('.badge-label').value.trim();
                const color = row.querySelector('.badge-color').value;
                if (key && label) {
                    finalBadges[key] = { label, color };
                }
            });
            if (!getContext().extensionSettings.plot) getContext().extensionSettings.plot = {};
            getContext().extensionSettings.plot.customBadges = finalBadges;
            
            // Save global goal injection settings
            getContext().extensionSettings.plot.goalInjection = {
                enabled: drawer.querySelector('.plot-drawer-inject-enabled-chk').checked,
                template: drawer.querySelector('.plot-drawer-inject-template').value,
                lineTemplate: drawer.querySelector('.plot-drawer-inject-line-template').value.trim()
            };
        }

        if (moduleId === 'variables') {
            if (!getContext().extensionSettings.plot) getContext().extensionSettings.plot = {};
            getContext().extensionSettings.plot.variablesInjection = {
                enabled: drawer.querySelector('.plot-drawer-var-inject-enabled-chk').checked,
                injectAll: drawer.querySelector('.plot-drawer-var-inject-all-chk').checked,
                template: drawer.querySelector('.plot-drawer-var-inject-template').value,
                lineTemplate: drawer.querySelector('.plot-drawer-var-inject-line-template').value.trim()
            };
        }
        
        getContext().extensionSettings.plot[`${moduleId}Modes`] = modes;
        getContext().saveSettingsDebounced?.();
        
        if (onSave) onSave(mode);
        hide();
    });
    
    // ── Lorebook checklist rendering ──
    const refreshLorebooksList = async () => {
        const ctx = getContext();
        const charBookName = ctx.characterBook;
        const chatBookName = ctx.chatBook;
        
        // Global books
        const globalBooks = ctx.worldInfoSettings?.world_info || [];
        
        const loadWorldInfoFn = loadWorldInfo || ctx.loadWorldInfo;
        if (!loadWorldInfoFn) return;
        
        const charContainer = drawer.querySelector('.plot-drawer-wi-char-container');
        const chatContainer = drawer.querySelector('.plot-drawer-wi-chat-container');
        const globalContainer = drawer.querySelector('.plot-drawer-wi-global-container');
        const customContainer = drawer.querySelector('.plot-drawer-wi-custom-container');
        
        const onToggle = (keyStr, checked) => {
            if (checked) {
                if (!lorebookSelections.includes(keyStr)) lorebookSelections.push(keyStr);
            } else {
                lorebookSelections = lorebookSelections.filter(x => x !== keyStr);
            }
        };
        
        // 1. Character Book
        if (drawer.querySelector('.plot-drawer-wi-char-chk').checked && charBookName) {
            await renderBookChecklist(charContainer, charBookName, '角色设定书', lorebookSelections, loadWorldInfoFn, onToggle);
        } else {
            charContainer.innerHTML = '';
        }
        
        // 2. Chat Book
        if (drawer.querySelector('.plot-drawer-wi-chat-chk').checked && chatBookName) {
            await renderBookChecklist(chatContainer, chatBookName, '对话设定书', lorebookSelections, loadWorldInfoFn, onToggle);
        } else {
            chatContainer.innerHTML = '';
        }
        
        // 3. Global Books
        globalContainer.innerHTML = '';
        if (drawer.querySelector('.plot-drawer-wi-global-chk').checked && globalBooks.length > 0) {
            await Promise.all(globalBooks.map(async (name) => {
                const bookDiv = document.createElement('div');
                globalContainer.appendChild(bookDiv);
                await renderBookChecklist(bookDiv, name, '全局设定书', lorebookSelections, loadWorldInfoFn, onToggle);
            }));
        }
        
        // 4. Custom Book
        const customBookName = drawer.querySelector('.plot-drawer-wi-custom-select').value;
        if (customBookName) {
            await renderBookChecklist(customContainer, customBookName, '独立设定书', lorebookSelections, loadWorldInfoFn, onToggle);
        } else {
            customContainer.innerHTML = '';
        }
    };
    
    // Bind checkbox/dropdown updates in lorebook settings to refresh checklist dynamically
    drawer.querySelector('.plot-drawer-wi-char-chk').addEventListener('change', refreshLorebooksList);
    drawer.querySelector('.plot-drawer-wi-chat-chk').addEventListener('change', refreshLorebooksList);
    drawer.querySelector('.plot-drawer-wi-global-chk').addEventListener('change', refreshLorebooksList);
    drawer.querySelector('.plot-drawer-wi-custom-select').addEventListener('change', refreshLorebooksList);
    
    // ── Regex rules renderer & editor ──
    const refreshRegexRulesList = () => {
        const listContainer = drawer.querySelector('.plot-drawer-regex-list');
        listContainer.innerHTML = '';
        
        localRegexRules.forEach((rule, idx) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:5px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85em; background:var(--SmartThemeChatTintColor); border:1px solid var(--SmartThemeBorderColor); border-radius:4px; margin-bottom: 4px;';
            
            const actionText = rule.action === 'delete' ? 'Delete Match' : (rule.action === 'keep' ? 'Keep Match' : `Replace: ${escapeHtml(rule.replace || '""')}`);
            const info = document.createElement('div');
            info.style.cssText = 'display:flex; flex-direction:column; gap:2px; overflow:hidden;';
            info.innerHTML = `
                <span style="font-weight:bold; color:var(--SmartThemeEmColor);">${escapeHtml(rule.name || '正则规则')}</span>
                <span style="font-family:monospace; font-size:0.8em; opacity:0.7; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Find: ${escapeHtml(rule.find)} | ${actionText}</span>
            `;
            row.appendChild(info);
            
            const btns = document.createElement('div');
            btns.style.cssText = 'display:flex; gap:4px; flex-shrink:0;';
            
            // Edit
            const editBtn = document.createElement('button');
            editBtn.className = 'plot-btn';
            editBtn.style.padding = '2px 6px;';
            editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
            editBtn.addEventListener('click', () => {
                showRegexEditorModal(rule.name, rule.find, rule.replace, rule.action || 'replace', (newName, newFind, newReplace, newAction) => {
                    rule.name = newName;
                    rule.find = newFind;
                    rule.replace = newReplace;
                    rule.action = newAction;
                    refreshRegexRulesList();
                });
            });
            btns.appendChild(editBtn);
            
            // Delete
            const delBtn = document.createElement('button');
            delBtn.className = 'plot-btn';
            delBtn.style.cssText = 'padding:2px 6px; color:var(--SmartThemeQuoteColor);';
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.addEventListener('click', () => {
                if (confirm(`删除规则 "${rule.name}" 吗？`)) {
                    localRegexRules.splice(idx, 1);
                    refreshRegexRulesList();
                }
            });
            btns.appendChild(delBtn);
            
            row.appendChild(btns);
            listContainer.appendChild(row);
        });
    };
    
    // Bind add regex button
    drawer.querySelector('.plot-drawer-regex-add-btn').addEventListener('click', () => {
        showRegexEditorModal('专属规则', '', '', 'replace', (name, find, replace, action) => {
            localRegexRules.push({ name, find, replace, action });
            refreshRegexRulesList();
        });
    });
    
    // Regex Overlay Modal Helper
    function showRegexEditorModal(initialName, initialFind, initialReplace, initialAction, onRuleSave) {
        let overlay = document.getElementById('plot-bts-regex-modal-overlay');
        if (overlay) {
            overlay.remove();
        }

        overlay = document.createElement('div');
        overlay.id = 'plot-bts-regex-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(var(--SmartThemeBlurTintColor-rgb), 0.95);
            color: var(--SmartThemeBodyColor);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 15px;
            box-sizing: border-box;
        `;
        overlay.innerHTML = `
            <div style="width: 320px; background: var(--SmartThemeChatTintColor); border: 1px solid var(--SmartThemeBorderColor); border-radius: 8px; padding: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 10px;">
                <div style="font-weight: bold; color: var(--SmartThemeEmColor); border-bottom: 1px solid var(--SmartThemeBorderColor); padding-bottom: 6px; margin-bottom: 4px; font-size:0.95em;">编辑模块正则裁剪规则</div>
                <div class="plot-setting-group">
                    <label class="plot-label" style="font-size: 0.8em;">规则名称</label>
                    <input type="text" id="plot-bts-regex-m-name" class="plot-input" style="width:100%;">
                </div>
                <div class="plot-setting-group">
                    <label class="plot-label" style="font-size: 0.8em;">匹配操作 (Action)</label>
                    <select id="plot-bts-regex-m-action" class="plot-select" style="width:100%; padding: 4px 8px; font-size: 0.9em; cursor:pointer;">
                        <option value="replace">替换为自定义文本 (Replace)</option>
                        <option value="delete">裁剪/删除匹配内容 (Delete)</option>
                        <option value="keep">只保留匹配内容 (Keep Only)</option>
                    </select>
                </div>
                <div class="plot-setting-group">
                    <label class="plot-label" style="font-size: 0.8em;">匹配表达式 (Regex Find)</label>
                    <input type="text" id="plot-bts-regex-m-find" class="plot-input" placeholder="/匹配内容/g" style="width:100%; font-family:monospace;">
                </div>
                <div class="plot-setting-group" id="plot-bts-regex-replace-group">
                    <label class="plot-label" style="font-size: 0.8em;">替换为 (Replace With)</label>
                    <input type="text" id="plot-bts-regex-m-replace" class="plot-input" placeholder="替换文本" style="width:100%;">
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                    <button id="plot-bts-regex-m-cancel" class="plot-btn" style="font-size:0.85em; padding:4px 10px;">取消</button>
                    <button id="plot-bts-regex-m-save" class="plot-btn" style="font-size:0.85em; padding:4px 10px; border-color: var(--SmartThemeEmColor); color: var(--SmartThemeEmColor);">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const nameInput = overlay.querySelector('#plot-bts-regex-m-name');
        const findInput = overlay.querySelector('#plot-bts-regex-m-find');
        const replaceInput = overlay.querySelector('#plot-bts-regex-m-replace');
        const actionSelect = overlay.querySelector('#plot-bts-regex-m-action');
        const replaceGroup = overlay.querySelector('#plot-bts-regex-replace-group');

        nameInput.value = initialName || '';
        findInput.value = initialFind || '';
        replaceInput.value = initialReplace || '';
        actionSelect.value = initialAction || 'replace';

        const updateReplaceVisibility = () => {
            if (actionSelect.value === 'delete' || actionSelect.value === 'keep') {
                replaceGroup.style.display = 'none';
            } else {
                replaceGroup.style.display = 'block';
            }
        };
        actionSelect.addEventListener('change', updateReplaceVisibility);
        updateReplaceVisibility();
        
        overlay.style.display = 'flex';
        
        const saveMBtn = overlay.querySelector('#plot-bts-regex-m-save');
        const cancelMBtn = overlay.querySelector('#plot-bts-regex-m-cancel');
        
        saveMBtn.addEventListener('click', () => {
            const n = nameInput.value.trim();
            const f = findInput.value.trim();
            const r = replaceInput.value;
            const act = actionSelect.value;
            
            if (!n || !f) {
                alert('名称与匹配表达式不能为空');
                return;
            }
            onRuleSave(n, f, r, act);
            overlay.remove();
        });
        
        cancelMBtn.addEventListener('click', () => {
            overlay.remove();
        });
    }

    // ── 3. Populate data on show ──
    const show = async () => {
        // Reset active tab to 'general' on show
        tabButtons.forEach(b => b.classList.remove('active'));
        const generalTabBtn = drawer.querySelector('#plot-drawer-tabs .plot-sub-tab[data-tab="general"]');
        if (generalTabBtn) generalTabBtn.classList.add('active');
        tabContents.forEach(content => {
            content.style.display = content.dataset.tab === 'general' ? 'flex' : 'none';
        });

        // Toggle displaying display and injection tab buttons based on module type
        const displayTabBtn = drawer.querySelector('#plot-drawer-tab-btn-display');
        const injectTabBtn = drawer.querySelector('#plot-drawer-tab-btn-inject');
        if (moduleId === 'goals' || moduleId === 'variables') {
            if (injectTabBtn) injectTabBtn.style.display = 'block';
        } else {
            if (injectTabBtn) injectTabBtn.style.display = 'none';
        }

        if (moduleId === 'goals') {
            if (displayTabBtn) displayTabBtn.style.display = 'block';
        } else {
            if (displayTabBtn) displayTabBtn.style.display = 'none';
        }
        // Load active mode and config
        currentModeId = await getActiveModeId(moduleId);
        localConfig = await getActiveModeConfig(moduleId);
        
        lorebookSelections = [...(localConfig.reading.manuallySelectedEntries || [])];
        localRegexRules = [...(localConfig.reading.regexRules || [])];
        
        // Fill mode name
        modeNameInput.value = localConfig.name || '默认模式';
        
        // Preset selects
        if (moduleId === 'goals') {
            drawer.querySelector('#plot-drawer-preset-group-single').style.display = 'none';
            drawer.querySelector('#plot-drawer-preset-group-split').style.display = 'flex';
            
            const presetsEval = extension_settings.plot?.presets?.['goals'] || {};
            presetEvalSelect.innerHTML = Object.entries(presetsEval)
                .map(([id, p]) => `<option value="${id}" ${id === (localConfig.presetId || 'default') ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
                .join('');
                
            const presetsGen = extension_settings.plot?.presets?.['goals_ai_gen'] || {};
            presetGenSelect.innerHTML = Object.entries(presetsGen)
                .map(([id, p]) => `<option value="${id}" ${id === (localConfig.generationPresetId || 'default') ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
                .join('');
        } else {
            drawer.querySelector('#plot-drawer-preset-group-single').style.display = 'block';
            drawer.querySelector('#plot-drawer-preset-group-split').style.display = 'none';
            
            const presets = extension_settings.plot?.presets?.[moduleId] || {};
            presetSelect.innerHTML = Object.entries(presets)
                .map(([id, p]) => `<option value="${id}" ${id === (localConfig.presetId || 'default') ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
                .join('');
        }
            
        // Connections
        const connections = listConnections() || [];
        connSelect.innerHTML = `
            <option value="default">SillyTavern 默认连接</option>
            ${connections.map(c => `<option value="${c.id}" ${c.id === (localConfig.connectionId || 'default') ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        `;
        
        // Connection toggle
        connToggle.checked = !!localConfig.useCustomConnection;
        connContainer.style.display = localConfig.useCustomConnection ? 'flex' : 'none';
        
        // Reading toggle
        readToggle.checked = !!localConfig.useCustomReading;
        readContainer.style.display = localConfig.useCustomReading ? 'flex' : 'none';
        
        // Reading limit
        readLimit.value = localConfig.reading.historyLimit !== undefined ? localConfig.reading.historyLimit : (localConfig.reading.limit !== undefined ? localConfig.reading.limit : 10);
        
        // Persona and Lorebooks selectors checks
        drawer.querySelector('.plot-drawer-char-desc-chk').checked = !!localConfig.reading.injectCharacterDescription;
        drawer.querySelector('.plot-drawer-user-desc-chk').checked = !!localConfig.reading.injectUserDescription;
        drawer.querySelector('.plot-drawer-wi-char-chk').checked = !!localConfig.reading.injectCharacterLorebook;
        drawer.querySelector('.plot-drawer-wi-chat-chk').checked = !!localConfig.reading.injectChatLorebook;
        drawer.querySelector('.plot-drawer-wi-global-chk').checked = !!localConfig.reading.injectGlobalLorebook;
        
        // Exclude and Include filters
        drawer.querySelector('.plot-drawer-wi-exclude').value = localConfig.reading.lorebookExcludePrefixes || '';
        drawer.querySelector('.plot-drawer-wi-include').value = localConfig.reading.lorebookIncludeFilter || '';
        
        // Summary JS expression
        drawer.querySelector('.plot-drawer-read-summary-expr').value = localConfig.reading.summaryJsExpression || '';
        
        // Custom Lorebook Names
        const ctx = getContext();
        const worldNamesList = ctx.getWorldInfoNames ? ctx.getWorldInfoNames() : [];
        const customSelect = drawer.querySelector('.plot-drawer-wi-custom-select');
        customSelect.innerHTML = `
            <option value="">-- 选择独立注入世界书 --</option>
            ${worldNamesList.map(name => `<option value="${name}" ${name === localConfig.reading.customLorebookName ? 'selected' : ''}>${name}</option>`).join('')}
        `;
        
        // Populate checklists
        await refreshLorebooksList();
        
        // Populate regex rules
        refreshRegexRulesList();
        
        let localCustomBadges = { ...(getContext().extensionSettings.plot?.customBadges || {}) };
        
        const refreshBadgesRulesList = () => {
            const listContainer = drawer.querySelector('#plot-drawer-badges-rules-list');
            if (!listContainer) return;
            listContainer.innerHTML = '';
            
            Object.entries(localCustomBadges).forEach(([key, val]) => {
                const row = document.createElement('div');
                row.className = 'plot-badge-rule-row';
                row.style.cssText = 'display: flex; gap: 6px; align-items: center; width: 100%; margin-bottom: 4px;';
                row.innerHTML = `
                    <input type="text" class="plot-input badge-key" placeholder="键名(如 reward)" value="${escapeHtml(key)}" disabled style="flex: 1; font-size: 0.82em; padding: 2px 4px; height: 24px;">
                    <input type="text" class="plot-input badge-label" placeholder="中文标签" value="${escapeHtml(val.label || '')}" style="flex: 1.2; font-size: 0.82em; padding: 2px 4px; height: 24px;">
                    <input type="color" class="badge-color" value="${escapeHtml(val.color || '#ffaa00')}" style="width: 28px; height: 24px; border: none; padding: 0; background: none; cursor: pointer; flex-shrink: 0;">
                    <i class="fa-solid fa-trash-can badge-delete" style="cursor: pointer; color: var(--SmartThemeQuoteColor); font-size: 0.85em; padding: 0 4px;" title="删除"></i>
                `;
                row.querySelector('.badge-delete').addEventListener('click', () => {
                    delete localCustomBadges[key];
                    refreshBadgesRulesList();
                });
                listContainer.appendChild(row);
            });
        };

        const addBadgeRuleBtn = drawer.querySelector('#plot-drawer-add-badge-rule-btn');
        if (addBadgeRuleBtn) {
            // Clone to remove previous listener
            const newAddBtn = addBadgeRuleBtn.cloneNode(true);
            addBadgeRuleBtn.parentNode.replaceChild(newAddBtn, addBadgeRuleBtn);
            newAddBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const key = prompt('请输入自定义字段英文键名（如 exp, clue）：');
                if (!key) return;
                const cleanKey = key.trim().replace(/[^a-zA-Z0-9_]/g, '');
                if (!cleanKey) return;
                
                if (localCustomBadges[cleanKey]) {
                    alert('该字段配置已存在！');
                    return;
                }
                
                localCustomBadges[cleanKey] = { label: cleanKey, color: '#e07832' };
                refreshBadgesRulesList();
            });
        }

        if (moduleId === 'goals') {
            drawer.querySelector('#plot-goals-display-settings').style.display = 'block';
            drawer.querySelector('#plot-goals-badges-settings').style.display = 'block';
            drawer.querySelector('#plot-goals-injection-settings').style.display = 'block';
            drawer.querySelector('#plot-variables-injection-settings').style.display = 'none';
            
            const display = localConfig.display || { showDesc: false, showStatus: true, showType: false };
            drawer.querySelector('.plot-drawer-display-desc-chk').checked = !!display.showDesc;
            drawer.querySelector('.plot-drawer-display-status-chk').checked = !!display.showStatus;
            drawer.querySelector('.plot-drawer-display-type-chk').checked = !!display.showType;
            
            refreshBadgesRulesList();
            
            // Load injection settings
            const goalInject = getContext().extensionSettings.plot?.goalInjection || {
                enabled: false,
                template: "当前任务:\n{{plot_goals_active}}",
                lineTemplate: "【{{title}}】{{desc}}"
            };
            const injectEnabledChk = drawer.querySelector('.plot-drawer-inject-enabled-chk');
            if (injectEnabledChk) {
                injectEnabledChk.checked = !!goalInject.enabled;
            }
            const injectTpl = drawer.querySelector('.plot-drawer-inject-template');
            if (injectTpl) {
                injectTpl.value = goalInject.template || '';
            }
            const injectLineTpl = drawer.querySelector('.plot-drawer-inject-line-template');
            if (injectLineTpl) {
                injectLineTpl.value = goalInject.lineTemplate || '';
            }
            const injectContainer = drawer.querySelector('.plot-goals-inject-container');
            if (injectContainer) {
                injectContainer.style.display = goalInject.enabled ? 'flex' : 'none';
            }
        } else if (moduleId === 'variables') {
            const displayGrp = drawer.querySelector('#plot-goals-display-settings');
            if (displayGrp) displayGrp.style.display = 'none';
            const badgesGrp = drawer.querySelector('#plot-goals-badges-settings');
            if (badgesGrp) badgesGrp.style.display = 'none';
            drawer.querySelector('#plot-goals-injection-settings').style.display = 'none';
            drawer.querySelector('#plot-variables-injection-settings').style.display = 'block';

            // Load variables injection settings
            const varInject = getContext().extensionSettings.plot?.variablesInjection || {
                enabled: true,
                injectAll: false,
                template: "当前状态:\n{{plot_variables_visible}}",
                lineTemplate: "- {{name}}: {{value}}"
            };
            const varInjectEnabledChk = drawer.querySelector('.plot-drawer-var-inject-enabled-chk');
            if (varInjectEnabledChk) {
                varInjectEnabledChk.checked = !!varInject.enabled;
            }
            const varInjectAllChk = drawer.querySelector('.plot-drawer-var-inject-all-chk');
            if (varInjectAllChk) {
                varInjectAllChk.checked = !!varInject.injectAll;
            }
            const varInjectTpl = drawer.querySelector('.plot-drawer-var-inject-template');
            if (varInjectTpl) {
                varInjectTpl.value = varInject.template || '';
            }
            const varInjectLineTpl = drawer.querySelector('.plot-drawer-var-inject-line-template');
            if (varInjectLineTpl) {
                varInjectLineTpl.value = varInject.lineTemplate || '';
            }
            const varInjectContainer = drawer.querySelector('.plot-variables-inject-container');
            if (varInjectContainer) {
                varInjectContainer.style.display = varInject.enabled ? 'flex' : 'none';
            }
        } else {
            const displayGrp = drawer.querySelector('#plot-goals-display-settings');
            if (displayGrp) displayGrp.style.display = 'none';
            const badgesGrp = drawer.querySelector('#plot-goals-badges-settings');
            if (badgesGrp) badgesGrp.style.display = 'none';
            drawer.querySelector('#plot-goals-injection-settings').style.display = 'none';
            drawer.querySelector('#plot-variables-injection-settings').style.display = 'none';
        }
        
        // Display Drawer
        drawer.style.display = 'flex';
        setTimeout(() => { drawer.classList.add('show'); }, 10);
    };
    
    return { show, hide };
}
