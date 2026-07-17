/**
 * tab-logs.js - Logs & Prompt Tester UI
 * Allows previewing compiled prompts and inspecting background API call logs or simulated logs.
 */

import { buildContext } from '../core/context-reader.js';
import { renderExtensionTemplateAsync, extension_settings } from '../../../../../extensions.js';
import { assemblePrompt } from '../core/prompt-builder.js';
import { getRealPromptMessages, lastApiLog } from '../core/api-client.js';
import { get } from '../core/store.js';
import { getActiveModeConfig } from './module-config-drawer.js';

const PBL_ROLE_COLORS = {
    system:    'rgba(80,120,220,0.25)',
    user:      'rgba(60,160,100,0.25)',
    assistant: 'rgba(190,120,50,0.25)',
};
const PBL_ROLE_LABELS = { system: 'System', user: 'User', assistant: 'AI' };

const MODULE_LABELS = {
    variables: '变量分析',
    goals:     '目标判定',
    goals_ai_gen: '目标生成',
    storyline: '故事线规划',
    backstage: '幕后模块'
};

function showFullTextModal(title, text) {
    let overlay = document.getElementById('plot-text-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'plot-text-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(var(--SmartThemeBlurTintColor-rgb), 1);
            color: var(--SmartThemeBodyColor);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            padding: 15px;
            box-sizing: border-box;
        `;
        overlay.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--SmartThemeBorderColor); padding-bottom: 8px; margin-bottom: 10px; flex-shrink: 0;">
                    <h3 id="plot-modal-title" style="margin: 0; color: var(--SmartThemeEmColor); font-size: 1.05em; font-weight: bold;">全屏查看</h3>
                    <i id="plot-modal-close" class="fa-solid fa-xmark" style="cursor: pointer; font-size: 1.3em; color: var(--SmartThemeEmColor);"></i>
                </div>
                <textarea id="plot-modal-textarea" class="plot-input" readonly style="flex: 1; width: 100%; font-family: monospace; font-size: 0.92em; line-height: 1.45; background-color: var(--SmartThemeInputBgColor); color: var(--SmartThemeInputTextColor); border: 1px solid var(--SmartThemeInputBorderColor); border-radius: 4px; resize: none; padding: 12px; box-sizing: border-box;"></textarea>
            </div>
        `;
        document.body.appendChild(overlay);
        
        overlay.querySelector('#plot-modal-close').addEventListener('click', () => {
            overlay.style.display = 'none';
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    }
    
    overlay.querySelector('#plot-modal-title').textContent = title;
    overlay.querySelector('#plot-modal-textarea').value = text;
    overlay.style.display = 'flex';
}

export async function renderLogsTab(containerEl) {
    const html = await renderExtensionTemplateAsync('third-party/plot', 'templates/tab-logs');
    containerEl.innerHTML = html;

    // ── Delegated Click Handler for Fullscreen Expand Button ──
    containerEl.addEventListener('click', (e) => {
        const expandBtn = e.target.closest('.plot-ta-expand');
        if (expandBtn) {
            const taId = expandBtn.dataset.ta;
            const title = expandBtn.dataset.title;
            const ta = containerEl.querySelector(`#${taId}`);
            if (ta) {
                showFullTextModal(title, ta.value);
            }
        }
    });

    // ── Local Sub Tab Switcher ──
    const panes = containerEl.querySelectorAll('.plot-log-pane');
    const tabs = containerEl.querySelectorAll('.plot-sub-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.logtab;
            
            // Switch tabs styling
            tabs.forEach(t => t.classList.toggle('active', t.dataset.logtab === target));
            
            // Switch panes visibility
            panes.forEach(p => {
                const paneId = `plot-log-pane-${target}`;
                p.style.display = (p.id === paneId) ? 'flex' : 'none';
            });

            // Auto-trigger rendering on tab show
            if (target === 'preview') {
                loadLogsPreview();
            } else if (target === 'logs') {
                renderLogs();
            }
        });
    });

    // ── Sub Tab 1: Live Preview Logic (Macro Preview) ──
    const loadLogsPreview = async () => {
        const previewArea = containerEl.querySelector('#plot-logs-preview-area');
        if (!previewArea) return;
        
        // Show loading state indicators
        const textareas = previewArea.querySelectorAll('textarea');
        textareas.forEach(ta => {
            ta.value = '加载中...';
        });

        try {
            const compiled = await buildContext();
            // buildContext() returns: { char_desc, user_desc, world_info, chat_history, summary }
            containerEl.querySelector('#plot-preview-char-desc').value   = compiled.char_desc    || '';
            containerEl.querySelector('#plot-preview-user-desc').value   = compiled.user_desc    || '';
            containerEl.querySelector('#plot-preview-world-info').value  = compiled.world_info   || '';
            containerEl.querySelector('#plot-preview-chat-history').value = compiled.chat_history || '';
            containerEl.querySelector('#plot-preview-summary').value     = compiled.summary      || '';
        } catch (err) {
            console.error('[Plot Logs] Error loading preview:', err);
            textareas.forEach(ta => {
                ta.value = `加载失败: ${err.message}`;
            });
        }
    };

    containerEl.querySelector('#plot-logs-refresh-btn').addEventListener('click', loadLogsPreview);

    // ── Sub Tab 2: Unified Logs Rendering (Real and Simulation Logs) ──
    const renderLogs = async () => {
        const logContainer = containerEl.querySelector('#plot-logs-logs-content');
        if (!logContainer) return;

        const selectEl = containerEl.querySelector('#plot-log-module-select');
        const mode = selectEl.value;

        if (mode === 'real') {
            renderRealApiLog(logContainer);
        } else {
            await renderSimulatedLog(logContainer, mode);
        }
    };

    const renderRealApiLog = (logContainer) => {
        if (!lastApiLog || !lastApiLog.timestamp) {
            logContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--SmartThemeEmColor); font-size:0.85em;">暂无真实 API 调用记录</div>`;
            return;
        }

        const dateStr = new Date(lastApiLog.timestamp).toLocaleTimeString();
        const isSuccess = lastApiLog.error === null || lastApiLog.error === undefined;

        // Extract or reconstruct messages array sent to API
        let requestMessages = [];
        if (lastApiLog.messages && Array.isArray(lastApiLog.messages)) {
            requestMessages = lastApiLog.messages;
        } else {
            if (lastApiLog.systemPrompt) requestMessages.push({ role: 'system', content: lastApiLog.systemPrompt });
            if (lastApiLog.userPrompt) {
                try {
                    const parsed = JSON.parse(lastApiLog.userPrompt);
                    if (Array.isArray(parsed)) {
                        requestMessages.push(...parsed);
                    } else {
                        requestMessages.push({ role: 'user', content: lastApiLog.userPrompt });
                    }
                } catch (_) {
                    requestMessages.push({ role: 'user', content: lastApiLog.userPrompt });
                }
            }
        }

        const messagesHtml = requestMessages.length === 0
            ? '<div style="color:var(--SmartThemeEmColor); font-size:0.85em; padding:4px;">暂无消息记录</div>'
            : requestMessages.map((msg, idx) => {
                const roleColor = PBL_ROLE_COLORS[msg.role] || 'rgba(128,128,128,0.2)';
                const roleLabel = PBL_ROLE_LABELS[msg.role] || msg.role;
                const taId = `apilog-msg-ta-${idx}`;
                return `
                    <div style="border:1px solid var(--SmartThemeBorderColor); border-radius:4px; overflow:hidden;">
                        <div class="plot-log-header" style="display:flex; justify-content:space-between; align-items:center; background:${roleColor}; padding:6px 10px; cursor:pointer; font-size:0.82em; border-bottom:1px solid rgba(255,255,255,0.03);">
                            <span style="font-weight:bold; color:var(--SmartThemeBodyColor);">${roleLabel} Prompt</span>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <i class="fa-solid fa-expand plot-ta-expand" data-ta="${taId}" data-title="${roleLabel} Message" style="cursor:pointer; color:var(--SmartThemeEmColor);" title="全屏查看"></i>
                                <i class="fa-solid fa-chevron-down plot-log-icon" style="transition: transform 0.2s; transform: rotate(180deg);"></i>
                            </div>
                        </div>
                        <div class="plot-log-body" style="display:flex; padding:8px;">
                            <textarea id="${taId}" class="plot-input" rows="8" readonly style="width:100%; font-family:monospace; font-size:0.82em; background-color: var(--SmartThemeInputBgColor); color: var(--SmartThemeInputTextColor); border:none; padding:8px; box-sizing:border-box; resize:vertical;">${msg.content || ''}</textarea>
                        </div>
                    </div>
                `;
            }).join('');

        let errorBannerHtml = '';
        if (lastApiLog.error) {
            const cleanErr = String(lastApiLog.error).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            errorBannerHtml = `
                <div style="border: 1px solid var(--SmartThemeQuoteColor); border-radius: 4px; padding: 12px; background: rgba(255, 0, 0, 0.05); color: var(--SmartThemeQuoteColor); font-size: 0.82em; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 8px;">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-top: 2px;"></i>
                    <div style="flex: 1;">
                        <strong style="display: block; margin-bottom: 2px;">API 调用异常/失败报告:</strong>
                        <code style="font-family: monospace; font-size: 0.9em; word-break: break-all; color: var(--SmartThemeQuoteColor);">${cleanErr}</code>
                    </div>
                </div>
            `;
        }

        logContainer.innerHTML = `
            ${errorBannerHtml}
            <div style="border:1px solid var(--SmartThemeBorderColor); border-radius:4px; padding:10px; background:rgba(0,0,0,0.1); display:flex; flex-direction:column; gap:4px; font-size:0.82em; margin-bottom:5px;">
                <div><strong>调用时间:</strong> ${dateStr}</div>
                <div><strong>接口连接:</strong> ${lastApiLog.connectionName || 'ST 默认'}</div>
                <div><strong>模型名称:</strong> ${lastApiLog.model || '未知'}</div>
                <div><strong>执行结果:</strong> <span style="font-weight:bold; color:${isSuccess ? 'var(--SmartThemeEmColor)' : 'var(--SmartThemeQuoteColor)'}">${isSuccess ? '成功' : '失败: ' + lastApiLog.error}</span></div>
            </div>

            <div style="font-weight:bold; color:var(--SmartThemeEmColor); margin-top:5px; font-size:0.85em; margin-bottom:5px;">发送的完整 Prompt</div>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:10px;">
                ${messagesHtml}
            </div>

            <div style="font-weight:bold; color:var(--SmartThemeEmColor); margin-top:5px; font-size:0.85em; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <span>AI 响应内容 (Response)</span>
                <i class="fa-solid fa-expand plot-ta-expand" data-ta="apilog-response-ta" data-title="AI Response" style="cursor:pointer;" title="全屏查看"></i>
            </div>
            <div style="border:1px solid var(--SmartThemeBorderColor); border-radius:4px; overflow:hidden;">
                <textarea id="apilog-response-ta" class="plot-input" rows="10" readonly style="width:100%; font-family:monospace; font-size:0.85em; background-color: var(--SmartThemeInputBgColor); color: var(--SmartThemeInputTextColor); border:none; padding:8px; box-sizing:border-box;">${lastApiLog.response || ''}</textarea>
            </div>
        `;

        // Bind collapsible header events
        logContainer.querySelectorAll('.plot-log-header').forEach(header => {
            const body = header.nextElementSibling;
            const icon = header.querySelector('.plot-log-icon');
            header.addEventListener('click', (e) => {
                if (e.target.classList.contains('plot-ta-expand')) return;
                const isOpen = body.style.display !== 'none';
                body.style.display = isOpen ? 'none' : 'flex';
                icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            });
        });
    };

    const renderSimulatedLog = async (logContainer, moduleId) => {
        logContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--SmartThemeBodyColor); font-size:0.85em;"><i class="fa-solid fa-spinner fa-spin"></i> 正在生成真实请求提示词...</div>`;

        try {
            const context = await buildContext();
            // Determine connection connectionId and preset override
            let connId = 'default';
            let presetIdOverride = null;
            
            if (moduleId === 'backstage') {
                const s = extension_settings.plot || {};
                const activeModeId = get('backstageActiveModeId') || 'default';
                const modes = s.backstageModes || [];
                const mode = modes.find(m => m.id === activeModeId);
                if (mode) {
                    connId = mode.useCustomConnection ? mode.connectionId : 'global';
                }
            } else if (moduleId === 'goals') {
                const cfg = await getActiveModeConfig('goals');
                connId = cfg.useCustomConnection ? cfg.connectionId : 'global';
                presetIdOverride = cfg.presetId || 'default';
            } else if (moduleId === 'goals_ai_gen') {
                const cfg = await getActiveModeConfig('goals');
                connId = cfg.useCustomConnection ? cfg.connectionId : 'global';
                presetIdOverride = cfg.generationPresetId || 'default';
            } else {
                const s = extension_settings.plot || {};
                connId = s.defaultConnectionId || 'default';
            }

            const promptParts = assemblePrompt(moduleId, context, {}, presetIdOverride);
            const moduleLabel = MODULE_LABELS[moduleId] || moduleId;

            // We simulate the API call payload creation (including ST system/formatting steps)
            const actualMessages = await getRealPromptMessages(promptParts.messages, '', connId);

            const messagesHtml = actualMessages.map((m, idx) => {
                const roleName = m.role.toUpperCase();
                const roleColor = PBL_ROLE_COLORS[m.role] || 'rgba(128,128,128,0.2)';
                const taId = `plot-sim-msg-ta-${idx}`;
                return `
                    <div style="border:1px solid var(--SmartThemeBorderColor); border-radius:4px; overflow:hidden;">
                        <div class="plot-sim-header" style="display:flex; justify-content:space-between; align-items:center; background:${roleColor}; padding:6px 10px; cursor:pointer; font-size:0.82em; border-bottom:1px solid rgba(255,255,255,0.03);">
                            <span style="font-weight:bold; color:var(--SmartThemeBodyColor);">[${roleName}] ${m.name || '提示词块'}</span>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <i class="fa-solid fa-expand plot-ta-expand" data-ta="${taId}" data-title="${moduleLabel} - [${roleName}] ${m.name || '提示词块'}" style="cursor:pointer; color:var(--SmartThemeEmColor);" title="全屏查看"></i>
                                <i class="fa-solid fa-chevron-down plot-sim-icon" style="transition: transform 0.2s; transform: rotate(180deg);"></i>
                            </div>
                        </div>
                        <div class="plot-sim-body" style="display:flex; padding:8px;">
                            <textarea id="${taId}" class="plot-input" rows="8" readonly style="width:100%; font-family:monospace; font-size:0.82em; background-color: var(--SmartThemeInputBgColor); color: var(--SmartThemeInputTextColor); border:none; padding:8px; box-sizing:border-box; resize:vertical;">${m.content || ''}</textarea>
                        </div>
                    </div>
                `;
            }).join('');

            logContainer.innerHTML = `
                <div style="border:1px solid var(--SmartThemeBorderColor); border-radius:4px; padding:10px; background:rgba(0,0,0,0.1); display:flex; flex-direction:column; gap:4px; font-size:0.82em; margin-bottom:5px;">
                    <div><strong>日志类型:</strong> 提示词模拟测试 (Simulated Prompt Tester)</div>
                    <div><strong>目标模块:</strong> ${moduleLabel}</div>
                    <div><strong>说明:</strong> 以下为经过 API 管道包装后，实际会发送给大模型接口的真实提示词请求队列。</div>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${messagesHtml || '<div style="text-align:center; padding:20px; color:var(--SmartThemeBodyColor);">没有启用的提示词块。</div>'}
                </div>
            `;

            // Bind collapsible events
            logContainer.querySelectorAll('.plot-sim-header').forEach(header => {
                const body = header.nextElementSibling;
                const icon = header.querySelector('.plot-sim-icon');
                header.addEventListener('click', (e) => {
                    if (e.target.classList.contains('plot-ta-expand')) return;
                    const isOpen = body.style.display !== 'none';
                    body.style.display = isOpen ? 'none' : 'flex';
                    icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
                });
            });

        } catch (err) {
            console.error('[Plot Logs] Error simulating API payload:', err);
            logContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--SmartThemeQuoteColor); font-size:0.85em;">测试生成失败: ${err.message}</div>`;
        }
    };

    containerEl.querySelector('#plot-logs-refresh-logs-btn').addEventListener('click', renderLogs);
    containerEl.querySelector('#plot-log-module-select').addEventListener('change', renderLogs);

    // Initial load: load Macro Preview first
    loadLogsPreview();
}
