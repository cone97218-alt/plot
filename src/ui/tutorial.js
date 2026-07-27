/**
 * tutorial.js - Tutorial & Macro Reference Guide Component
 * Renders user guide and full macro documentation for the Backstage module.
 */

export function renderTutorial(containerEl) {
    if (!containerEl) return;

    const html = `
        <div class="plot-tutorial-container" style="padding: 10px; font-size: 0.88em; color: var(--SmartThemeBodyColor); line-height: 1.5;">
            
            <!-- Section 1: Overview -->
            <div style="margin-bottom: 20px; border-bottom: 1px solid var(--SmartThemeBorderColor); padding-bottom: 12px;">
                <h3 style="margin: 0 0 8px 0; color: var(--SmartThemeEmColor); font-size: 1.1em; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-masks-theater"></i> 幕后 (Backstage) 模块使用指南
                </h3>
                <p style="margin: 0; opacity: 0.9; font-size: 0.9em;">
                    Plot 剧情推动扩展的<b>【幕后】模块</b>是一个独立的二级对话与 AI 辅助思考控制台。它与酒馆的主线对话记录相互隔离，允许你随时拉出面板与 AI 进行幕后讨论、导演干预、剧情策划或分支试验。
                </p>
            </div>

            <!-- Section 2: Macro Documentation -->
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: var(--SmartThemeEmColor); font-size: 1em; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-code"></i> 可用宏 / 模板插槽列表 (Macro Reference)
                </h4>
                <p style="margin: 0 0 12px 0; opacity: 0.85; font-size: 0.85em;">
                    在<b>【提示词工作台】</b>中配置提示词卡片时，可使用以下模板宏。解析引擎会在调用 AI 前自动将其替换为真实上下文内容。（点击代码块可直接复制）：
                </p>

                <!-- Category 1 -->
                <div style="background: transparent; border-radius: 6px; border: 1px solid var(--SmartThemeBorderColor); padding: 10px; margin-bottom: 12px;">
                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.9em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-comments"></i> 1. 幕后通道专属宏
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <div>
                                <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{backstage_user_input}}</code>
                                <span style="font-size: 0.78em; opacity: 0.7; margin-left: 4px;">(别名: <code>{{bts_user_input}}</code>)</span>
                            </div>
                            <span style="font-size: 0.85em;">幕后输入框中最新提交的文本或指令</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <div>
                                <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{backstage_chat_history}}</code>
                                <span style="font-size: 0.78em; opacity: 0.7; margin-left: 4px;">(别名: <code>{{bts_chat_history}}</code>)</span>
                            </div>
                            <span style="font-size: 0.85em;">幕后模块本地二轨独立历史对话记录</span>
                        </div>
                    </div>
                </div>

                <!-- Category 2 -->
                <div style="background: transparent; border-radius: 6px; border: 1px solid var(--SmartThemeBorderColor); padding: 10px; margin-bottom: 12px;">
                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.9em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-book-open-reader"></i> 2. 主线上下文抓取宏
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{chat_history}}</code>
                            <span style="font-size: 0.85em;">抓取并脱敏过滤后的主线对话历史记录</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{char_desc}}</code>
                            <span style="font-size: 0.85em;">当前角色卡的设定与性格描述文本</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{user_desc}}</code>
                            <span style="font-size: 0.85em;">当前 User Persona (用户设定说明)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{summary}}</code>
                            <span style="font-size: 0.85em;">计算或提取的主线会话总结摘要</span>
                        </div>
                    </div>
                </div>

                <!-- Category 3 -->
                <div style="background: transparent; border-radius: 6px; border: 1px solid var(--SmartThemeBorderColor); padding: 10px; margin-bottom: 12px;">
                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.9em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-atlas"></i> 3. 世界书 (Lorebook) 深度宏
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{world_info_before}}</code>
                            <span style="font-size: 0.85em;">插入在 Depth 前的世界书条目文本</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{world_info_after}}</code>
                            <span style="font-size: 0.85em;">插入在 Depth 后的世界书条目文本</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{world_info_depth}}</code>
                            <span style="font-size: 0.85em;">指定 Depth 注入深度位置的世界书条目</span>
                        </div>
                    </div>
                </div>

                <!-- Category 4 -->
                <div style="background: transparent; border-radius: 6px; border: 1px solid var(--SmartThemeBorderColor); padding: 10px;">
                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.9em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-user-tag"></i> 4. 角色与用户基础宏
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <div>
                                <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{char}}</code>
                                <span style="font-size: 0.78em; opacity: 0.7; margin-left: 4px;">(别名: <code>{{character}}</code>)</span>
                            </div>
                            <span style="font-size: 0.85em;">当前激活的角色卡名称</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 4px 8px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor);">
                            <code class="plot-copy-macro" style="color: #4bacd9; font-weight: bold; cursor: pointer;" title="点击复制">{{user}}</code>
                            <span style="font-size: 0.85em;">当前 User (用户) 名称</span>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Toast notification container for copy confirmation -->
            <div id="plot-tutorial-toast" style="display: none; position: fixed; bottom: 20px; right: 20px; background: var(--SmartThemeBodyColor); color: var(--SmartThemeBgColor); padding: 6px 14px; border-radius: 4px; font-size: 0.85em; z-index: 1000000; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                已复制宏到剪贴板！
            </div>
        </div>
    `;

    containerEl.innerHTML = html;

    // Bind copy-on-click for macro tags
    containerEl.querySelectorAll('.plot-copy-macro').forEach(codeEl => {
        codeEl.addEventListener('click', async () => {
            const macroText = codeEl.textContent.trim();
            try {
                await navigator.clipboard.writeText(macroText);
                showToast(`已复制 ${macroText} 到剪贴板！`);
            } catch (err) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = macroText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showToast(`已复制 ${macroText} 到剪贴板！`);
            }
        });
    });

    function showToast(msg) {
        const toast = containerEl.querySelector('#plot-tutorial-toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 1800);
    }
}
