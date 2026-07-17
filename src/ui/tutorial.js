export function renderTutorial(containerEl) {
    containerEl.innerHTML = `
        <div class="plot-tutorial-wrapper" style="padding: 10px 15px; display: flex; flex-direction: column; gap: 8px; color: var(--SmartThemeBodyColor); overflow-y: auto; height: 100%; max-height: 480px; box-sizing: border-box; padding-right: 5px;">
            
            <!-- 三级 Tab 导航栏 -->
            <div class="plot-sub-tab-bar" id="plot-help-tabs" style="display: flex !important; margin-bottom: 0px !important; padding-bottom: 0px !important; border-bottom: 1px solid var(--SmartThemeBorderColor) !important; flex-shrink: 0 !important; gap: 0px !important;">
                <button class="plot-sub-tab active" data-helptab="backstage" style="display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeEmColor); font-weight: bold; border-radius: 4px; padding: 4px 10px; font-size: 0.85em; margin-bottom: 0px !important;">
                    <i class="fa-solid fa-masks-theater"></i> <span>幕后教程</span>
                </button>
            </div>

            <!-- 面板 1: 幕后模块教程 -->
            <div id="plot-help-pane-backstage" class="plot-help-pane" style="display: flex; flex-direction: column; gap: 10px;">
                
                <!-- 第一部分：宏与占位符 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-code"></i> <span>第一部分：幕后可用宏与占位符详析</span>
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="plot-btn plot-copy-btn" style="padding: 2px 8px; font-size: 0.8em; height: 24px; display: flex; align-items: center; gap: 4px;" title="复制本部分内容">
                                <i class="fa-solid fa-copy"></i> 复制
                            </button>
                            <i class="fa-solid fa-chevron-right plot-fold-icon" style="transition: transform 0.2s; font-size: 0.85em;"></i>
                        </div>
                    </div>
                    <div class="plot-tutorial-body" style="padding: 12px; display: none; font-size: 0.82em; line-height: 1.6; border-top: 1px solid var(--SmartThemeBorderColor); background: transparent;">
                        <!-- 复制目标：包含原始 Markdown，脱离布局隐藏 -->
                        <pre class="plot-copy-target" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
#### 幕后可用宏与占位符完整速查表 (Macros & Placeholders)

在“幕后”模块组装提示词预设（可在“提示词” -> “幕后”子页编辑卡片块）时，系统提供了以下所有内置的宏占位符。在向大模型发送请求时，这些占位符会被动态解析为对应的运行时上下文数据：

##### 1. 幕后控制台专属输入与历史
*   {{backstage_user_input}} (别名: {{bts_user_input}})
    *   **概述**：用户在幕后控制台底部的输入框中填写的最新一条指令/对话文本。
    *   **作用**：主要用于指导 AI 接收最新的创作命令，指示后续情节发展。
*   {{backstage_chat_history}} (别名: {{bts_chat_history}})
    *   **概述**：幕后副对话窗口本身的对话历史记录。
    *   **作用**：让 AI 能够理解当前幕后讨论的上下文，包含用户与 AI 之前的多轮幕后设定切磋。

##### 2. 主聊天会话上下文
*   {{chat_history}}
    *   **概述**：主聊天对话记录中经脱敏、净化（通过正则裁剪）后的最新聊天消息文本。
    *   **作用**：让幕后 AI 得知主聊天的当前进展。其读取深度受“内容读取”中“历史对话读取深度”的控制。
*   {{summary}}
    *   **概述**：SillyTavern 系统自带的当前会话总结（Summary）文本。
    *   **作用**：提供故事发展长线背景的梗概，有助于 AI 维持长剧情逻辑。
*   {{char}} (别名: {{character}})
    *   **概述**：当前激活的角色卡名称。
    *   **作用**：在编写提示词模板时作为角色代称占位符。
*   {{user}}
    *   **概述**：当前用户的 Persona 名字。
    *   **作用**：在提示词中代表玩家或作者名称。

##### 3. 角色设定与描述
*   {{char_desc}}
    *   **概述**：当前角色卡的角色设定描述（Character Description）文本。
    *   **作用**：使幕后 AI 准确理解当前角色的外貌、性格、人设背景。
*   {{user_desc}}
    *   **概述**：当前用户的个人描述（Persona Description）文本。
    *   **作用**：向 AI 描述当前用户的外貌、背景等设定。

##### 4. 多重世界书信息 (Lorebook)
*   {{world_info}}
    *   **概述**：注入当前会话的所有激活世界书（包括角色书、全局书、聊天书及插件独立配置的世界书）的触发条目总文本。
    *   **作用**：为大模型提供详尽的设定和世界观规则库。
*   {{world_info_before}}
    *   **概述**：定义在角色卡设定之前注入的世界书条目总文本。
    *   **作用**：可用于载入最基础、优先级最高的世界观底层规则。
*   {{world_info_after}}
    *   **概述**：定义在角色卡设定之后注入的世界书条目总文本。
    *   **作用**：可用于载入次要设定或临时触发的状态描述。
*   {{world_info_depth}}
    *   **概述**：代表当前世界书注入的最大扫描深度限制及扫描详情（历史遗留的深度提示词）。

##### 5. 核心模块状态与数据
*   {{variables_list}}
    *   **概述**：当前正在追踪的数字和文本变量及其数值的序列化清单。
    *   **作用**：将好感度、黑化值、当前场景位置等数值和状态同步给 AI。
*   {{goals_list}}
    *   **概述**：当前启用的所有剧情目标（Goals）列表及其判定达成状态的序列化清单。
    *   **作用**：让 AI 获取待达成的任务目标详情。
*   {{storyline_status}}
    *   **概述**：当前激活的故事线分支名称、当前阶段以及状态描述的序列化文本。
    *   **作用**：向 AI 传递当前故事的大体章节阶段。

##### 6. 辅助控制宏
*   {{response_format}}
    *   **概述**：由系统根据当前模块自动生成的响应格式要求提示语（如“请仅以 JSON 格式输出，不要包含其他文本”）。
    *   **作用**：强制规范 AI 回复格式（在幕后模式下通常解析为空白，因为幕后输出为纯文本；在变量与目标模块中起控制作用）。
*   {{module_system_prompt}}、{{module_user_prompt}}、{{module_assistant_prompt}}
    *   **概述**：旧版预设插槽宏，现已弃用（解析时会直接被替换为空白字符），确保新版卡片工作台拼接的纯净性。
                        </pre>

                        <!-- 展示目标：精美排版排好的 HTML 内容 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">在“幕后”模块组装提示词预设（卡片块）时，可以使用以下宏占位符。在发送请求时，它们会被解析为对应的上下文数据：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. 幕后控制台专属输入与历史</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{backstage_user_input}}</code> (或 <code>{{bts_user_input}}</code>)
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>用户在幕后控制台底部的输入框中填写的最新一条指令/对话文本。</div>
                                            <div style="opacity: 0.75; font-size: 0.9em;"><strong>作用：</strong>主要用于指导 AI 接收最新的创作命令，指示后续情节发展。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{backstage_chat_history}}</code> (或 <code>{{bts_chat_history}}</code>)
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>幕后副对话窗口本身的对话历史记录。</div>
                                            <div style="opacity: 0.75; font-size: 0.9em;"><strong>作用：</strong>让 AI 能够理解当前幕后讨论的上下文，包含用户与 AI 之前的多轮幕后设定切磋。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">2. 主聊天会话上下文</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{chat_history}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>主聊天对话记录中经脱敏、净化（通过正则裁剪）后的最新聊天消息文本。</div>
                                            <div style="opacity: 0.75; font-size: 0.9em;"><strong>作用：</strong>让幕后 AI 得知主聊天的当前进展。其读取深度受“内容读取”中“历史对话读取深度”的控制。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{summary}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>SillyTavern 系统自带的当前会话总结（Summary）文本。</div>
                                            <div style="opacity: 0.75; font-size: 0.9em;"><strong>作用：</strong>提供故事发展长线背景的梗概，有助于 AI 维持长剧情逻辑。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{char}}</code> (或 <code>{{character}}</code>) / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{user}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>当前激活的角色卡名称与用户的 Persona 名字，在编写提示词模板时作为角色/玩家代称占位符。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">3. 角色设定与描述</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{char_desc}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>当前角色卡的角色设定描述（Character Description）文本。</div>
                                            <div style="opacity: 0.75; font-size: 0.9em;"><strong>作用：</strong>使幕后 AI 准确理解当前角色的外貌、性格、人设背景。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{user_desc}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>当前用户的个人描述（Persona Description）文本。</div>
                                            <div style="opacity: 0.75; font-size: 0.9em;"><strong>作用：</strong>向 AI 描述当前用户的外貌、背景等设定。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">4. 多重世界书信息 (Lorebook)</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{world_info}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>注入当前会话的所有激活世界书（包括角色书、全局书、聊天书等）的触发条目总文本，为大模型提供世界观规则库。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{world_info_before}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{world_info_after}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>定义在角色卡设定之前或之后注入的世界书条目总文本，用于载入底层规则或临时状态。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{world_info_depth}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>代表当前世界书注入的最大扫描深度限制及扫描详情（历史遗留的深度提示词）。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">5. 核心模块状态与数据</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{variables_list}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>当前正在追踪的数字和文本变量及其数值的序列化清单。</div>
                                            <div style="opacity: 0.75; font-size: 0.9em;"><strong>作用：</strong>将好感度、黑化值、当前场景位置等数值和状态同步给 AI。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{goals_list}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>当前启用的所有剧情目标（Goals）列表及其判定达成状态的序列化清单。</div>
                                            <div style="opacity: 0.75; font-size: 0.9em;"><strong>作用：</strong>让 AI 获取待达成的任务目标详情。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{storyline_status}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>当前激活的故事线分支名称、当前阶段以及状态描述的序列化文本，用于向 AI 传递大体章节进度。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">6. 辅助控制宏</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{response_format}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>系统生成的格式化回复提示（变量与目标判定模块中，用于强制规范 JSON 格式输出）。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{module_system_prompt}}</code> / <code>{{module_user_prompt}}</code> / <code>{{module_assistant_prompt}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>旧版预设插槽宏（现已弃用，解析时直接替换为空白，保障拼接纯净性）。</div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 第二部分：CSS 类名 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-palette"></i> <span>第二部分：幕后对话气泡区 CSS 类名详解</span>
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="plot-btn plot-copy-btn" style="padding: 2px 8px; font-size: 0.8em; height: 24px; display: flex; align-items: center; gap: 4px;" title="复制本部分内容">
                                <i class="fa-solid fa-copy"></i> 复制
                            </button>
                            <i class="fa-solid fa-chevron-right plot-fold-icon" style="transition: transform 0.2s; font-size: 0.85em;"></i>
                        </div>
                    </div>
                    <div class="plot-tutorial-body" style="padding: 12px; display: none; font-size: 0.82em; line-height: 1.6; border-top: 1px solid var(--SmartThemeBorderColor); background: transparent;">
                        <!-- 复制目标：包含原始 Markdown，脱离布局隐藏 -->
                        <pre class="plot-copy-target" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
#### 幕后气泡对话区域 (Dialogue Area) CSS 类名及样式拆解

在编写自定义幕后主题样式时，可以使用以下详尽的 CSS 类名对气泡区域进行精细微调。此类名已拆分到最小 HTML 结构单位：

##### 1. 会话区域整体容器
*   \`.plot-bts-dialogue-area\`：对话气泡的父级纵向滚动区域容器 (\`<div>\`)。控制整体内边距 (\`padding: 15px\`)、滚动行为和泡泡垂直间距 (\`gap: 12px\`)。

##### 2. 消息单行外层布局 (Message Row)
*   \`.plot-bts-msg-row\`：包裹头像与气泡容器的单行外围盒子 (\`max-width: 85%\`)。
*   \`.plot-bts-msg-row.user\` / \`.plot-bts-msg-row.bot\`：用户发送消息行 (靠右对齐，反排列) 与 AI 发送消息行 (靠左对齐，正向排列)。
*   \`.plot-bts-msg-row.typing-indicator-row\` / \`.plot-bts-msg-row.temp-stream-row\`：AI 正在打字输出时的临时行级盒子。

##### 3. 头像与头像框组件
*   \`.plot-bts-avatar-wrapper\`：包裹头像和头像框的定位容器 (\`width: 38px; height: 38px;\`)。
*   \`.plot-bts-avatar\`：圆形头像图片元素 (\`<img>\`, \`border-radius: 50%\`)。
*   \`.plot-bts-avatar-frame\`：覆盖于头像上层的框架容器 (\`position: absolute; inset: -3px\`)。修饰类包含:
    *   \`.glowing-gold\`：金色发光呼吸特效。
    *   \`.glassmorphism\`：微白半透明毛玻璃框架。
    *   \`.neon-blue\`：霓虹科技蓝发光边框。

##### 4. 气泡复合容器 (Bubble Wrapper)
*   \`.plot-bts-bubble-container\`：包裹消息气泡本体和下方分页指示器的垂直容器。
*   \`.plot-bts-bubble\`：承载消息文本和悬浮工具栏的气泡主盒子。控制圆角 (\`border-radius: 12px\`)、padding 及默认阴影。
*   \`.plot-bts-bubble-text\`：承载具体文本内容的包裹器，内含 Markdown 生成的超链接 (\`a\`)、段落 (\`p\`)、代码块 (\`pre\`)、行内代码 (\`code\`)。

##### 5. 悬浮快捷工具栏
*   \`.plot-bts-bubble-actions\`：鼠标 Hover 时气泡底边浮现的工具栏容器 (\`position: absolute; bottom: -22px\`)。
*   \`.plot-bts-action-btn\`：工具栏中的各操作图标按钮。监听类包含:
    *   \`.plot-msg-edit\`：编辑并重发消息。
    *   \`.plot-msg-regenerate-user\`：重新生成 AI 回应。
    *   \`.plot-msg-retry\`：重新生成并覆盖当前 AI 回应。
    *   \`.plot-msg-swipe\`：追加生成新候选回复 (Swipe)。
    *   \`.plot-msg-modify\`：手动修改气泡内容。
    *   \`.plot-msg-delete\`：物理删除该条消息。

##### 6. Swipe 翻页面板与打字状态
*   \`.plot-bts-swipe-indicators\`：多分支气泡下方的翻页控制栏，含 \`.plot-swipe-prev\` (左翻页) 与 \`.plot-swipe-next\` (右翻页)。
*   \`.plot-bts-typing-indicator\`：打字等待状态下的三个跳动小圆点容器，内有 \`span\` 跳动圆点。
                        </pre>

                        <!-- 展示目标：精美排版排好的 HTML 内容 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">在编写自定义幕后主题 CSS 时，可使用以下结构类名进行精细样式定义：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. 会话区域整体容器</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-dialogue-area</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">气泡总容器 (<code>&lt;div&gt;</code>)，控制内边距、滚动行为和泡泡间距。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">2. 消息单行外层布局 (Message Row)</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-msg-row</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">单行消息的外层 flex 盒子，包含头像与气泡容器。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-msg-row.user</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-msg-row.bot</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">控制发送方为用户 (靠右反排列) 或 AI 角色 (靠左正排列)。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-msg-row.typing-indicator-row</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">AI 正在生成回复或显示打字机小圆点时的临时行容器。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">3. 头像与头像框组件</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-avatar-wrapper</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-avatar</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">头像包裹框与头像图片 img 标签样式。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-avatar-frame</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">覆在头像上层的精美装饰边框，带特定修饰类 <code>.glowing-gold</code>, <code>.glassmorphism</code>, <code>.neon-blue</code>。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">4. 气泡复合容器与本体 (Bubble)</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-bubble-container</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-bubble</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">气泡外围容器，与气泡本体背景、圆角及内边距样式。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-bubble-text</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">气泡内 Markdown 转换后的 HTML 文本元素包裹器。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">5. 悬浮快捷工具栏与动作</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-bubble-actions</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-action-btn</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">Hover 时底部显现的操作按钮栏及图标（含编辑、重生成、重 roll、修改、删除等动作修饰类）。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">6. Swipe 分页翻页指示及打字状态</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-swipe-indicators</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-typing-indicator</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">多分支翻页指示器 (左右翻页箭头) 与跳动等待圆点样式。</div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    `;

    // ── 绑定交互事件 ──
    initHelpSectionInteractions(containerEl);
}

function initHelpSectionInteractions(containerEl) {
    // 1. 折叠栏收起/展开逻辑
    const sections = containerEl.querySelectorAll('.plot-tutorial-section');
    sections.forEach(sec => {
        const header = sec.querySelector('.plot-tutorial-header');
        const body = sec.querySelector('.plot-tutorial-body');
        const icon = sec.querySelector('.plot-fold-icon');
        
        header.addEventListener('click', (e) => {
            // 如果点击的是复制按钮，不触发折叠
            if (e.target.closest('.plot-copy-btn')) return;
            
            const isCollapsed = body.style.display === 'none';
            body.style.display = isCollapsed ? 'block' : 'none';
            icon.style.transform = isCollapsed ? 'rotate(90deg)' : 'rotate(0deg)';
        });
    });

    // 2. 一键复制功能
    const copyBtns = containerEl.querySelectorAll('.plot-copy-btn');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const body = btn.closest('.plot-tutorial-section').querySelector('.plot-copy-target');
            const text = body.innerText || body.textContent;
            
            // 去除最外层可能存在的多余空行并整理格式
            const formattedText = text.trim();
            
            navigator.clipboard.writeText(formattedText).then(() => {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
                btn.style.color = 'var(--SmartThemeUnderlineColor)';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.style.color = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert('复制失败，请手动选择复制！');
            });
        });
    });
}
