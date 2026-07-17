export function renderTutorial(containerEl) {
    console.log('[Plot Help] Fresh tutorial rendering triggered.');
    const htmlStr = `
        <div class="plot-tutorial-wrapper" style="padding: 10px 5px; display: flex; flex-direction: column; gap: 12px; color: var(--SmartThemeBodyColor); box-sizing: border-box;">
            
            <!-- 三级 Tab 导航栏 -->
            <div class="plot-sub-tab-bar" id="plot-help-tabs" style="display: flex !important; margin-bottom: 0px !important; padding-bottom: 0px !important; border-bottom: 1px solid var(--SmartThemeBorderColor) !important; flex-shrink: 0 !important; gap: 0px !important;">
                <button class="plot-sub-tab active" data-helptab="general" style="display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeEmColor); font-weight: bold; border-radius: 4px; padding: 4px 10px; font-size: 0.85em; margin-bottom: 0px !important;">
                    <i class="fa-solid fa-earth-americas"></i> <span>通用</span>
                </button>
                <button class="plot-sub-tab" data-helptab="backstage" style="display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeEmColor); font-weight: bold; border-radius: 4px; padding: 4px 10px; font-size: 0.85em; margin-bottom: 0px !important; margin-left: 8px !important;">
                    <i class="fa-solid fa-masks-theater"></i> <span>幕后教程</span>
                </button>
                <button class="plot-sub-tab" data-helptab="goals" style="display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeEmColor); font-weight: bold; border-radius: 4px; padding: 4px 10px; font-size: 0.85em; margin-bottom: 0px !important; margin-left: 8px !important;">
                    <i class="fa-solid fa-clipboard-list"></i> <span>目标与注入教程</span>
                </button>
                <button class="plot-sub-tab" data-helptab="variables" style="display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeEmColor); font-weight: bold; border-radius: 4px; padding: 4px 10px; font-size: 0.85em; margin-bottom: 0px !important; margin-left: 8px !important;">
                    <i class="fa-solid fa-sliders"></i> <span>变量与触发器教程</span>
                </button>
            </div>

            <!-- 面板 0: 通用教程 -->
            <div id="plot-help-pane-general" class="plot-help-pane" style="display: flex; flex-direction: column; gap: 10px;">
                
                <!-- 第一部分：全局通用宏与占位符 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-earth-americas"></i> <span>第一部分：全局通用占位符与宏详析</span>
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="plot-btn plot-copy-btn" style="padding: 2px 8px; font-size: 0.8em; height: 24px; display: flex; align-items: center; gap: 4px;" title="复制本部分内容">
                                <i class="fa-solid fa-copy"></i> 复制
                            </button>
                            <i class="fa-solid fa-chevron-right plot-fold-icon" style="transition: transform 0.2s; font-size: 0.85em;"></i>
                        </div>
                    </div>
                    <div class="plot-tutorial-body" style="padding: 12px; display: none; font-size: 0.82em; line-height: 1.6; border-top: 1px solid var(--SmartThemeBorderColor); background: transparent;">
                        <!-- 复制目标 -->
                        <pre class="plot-copy-target" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
#### 全局通用提示词占位符与宏 (General Macros & Placeholders)

系统提供了以下内置 of 全局通用宏占位符。在向大模型发送请求时，这些占位符会被动态解析为对应的运行时上下文数据：

##### 1. 主聊天会话上下文
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

##### 2. 角色设定与描述
*   {{char_desc}}
    *   **概述**：当前角色卡的角色设定描述（Character Description）文本。
    *   **作用**：使幕后 AI 准确理解当前角色的外貌、性格、人设背景。
*   {{user_desc}}
    *   **概述**：当前用户的个人描述（Persona Description）文本。
    *   **作用**：向 AI 描述当前用户的外貌、背景等设定。

##### 3. 多重世界书信息 (Lorebook)
*   {{world_info}}
    *   **概述**：注入当前会话的所有激活世界书（包括角色书、全局书、聊天书及插件独立配置的世界书）的触发条目总文本。
    *   **作用**：为大模型提供详尽的设定 and 世界观规则库。
*   {{world_info_before}}
    *   **概述**：定义在角色卡设定之前注入的世界书条目总文本。
    *   **作用**：可用于载入最基础、优先级最高的世界观底层规则。
*   {{world_info_after}}
    *   **概述**：定义在角色卡设定之后注入的世界书条目总文本。
    *   **作用**：可用于载入次要设定或临时触发的状态描述。
*   {{world_info_depth}}
    *   **概述**：代表当前世界书注入的最大扫描深度限制及扫描详情（历史遗留的深度提示词）。
                        </pre>

                        <!-- 展示目标 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">系统提供的以下全局通用宏占位符，在发送请求时会被动态解析为对应的运行时上下文数据：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. 主聊天会话上下文</div>
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
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>当前激活角色卡名称与用户的 Persona 名字，在编写提示词模板时作为角色/玩家代称占位符。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">2. 角色设定与描述</div>
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
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">3. 多重世界书信息 (Lorebook)</div>
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
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <!-- 面板 1: 幕后模块教程 -->
            <div id="plot-help-pane-backstage" class="plot-help-pane" style="display: none; flex-direction: column; gap: 10px;">
                
                <!-- 第一部分：宏与占位符 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-code"></i> <span>第一部分：幕后控制台专属占位符与宏详析</span>
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="plot-btn plot-copy-btn" style="padding: 2px 8px; font-size: 0.8em; height: 24px; display: flex; align-items: center; gap: 4px;" title="复制本部分内容">
                                <i class="fa-solid fa-copy"></i> 复制
                            </button>
                            <i class="fa-solid fa-chevron-right plot-fold-icon" style="transition: transform 0.2s; font-size: 0.85em;"></i>
                        </div>
                    </div>
                    <div class="plot-tutorial-body" style="padding: 12px; display: none; font-size: 0.82em; line-height: 1.6; border-top: 1px solid var(--SmartThemeBorderColor); background: transparent;">
                        <!-- 复制目标 -->
                        <pre class="plot-copy-target" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
#### 幕后控制台专属占位符与宏速查表 (Backstage-Exclusive Macros)

在“幕后”模块组装提示词预设（可在“提示词” -> “幕后”子页编辑卡片块）时，系统提供了以下专属的宏占位符。在向大模型发送请求时，这些占位符会被动态解析为对应的运行时上下文数据：

##### 1. 幕后控制台专属输入与历史
*   {{backstage_user_input}} (别名: {{bts_user_input}})
    *   **概述**：用户在幕后控制台底部的输入框中填写的最新一条指令/对话文本。
    *   **作用**：主要用于指导 AI 接收最新的创作命令，指示后续情节发展。
*   {{backstage_chat_history}} (别名: {{bts_chat_history}})
    *   **概述**：幕后副对话窗口本身的对话历史记录。
    *   **作用**：让 AI 能够理解当前幕后讨论的上下文，包含用户与 AI 之前的多轮幕后设定切磋。
                        </pre>

                        <!-- 展示目标 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">在“幕后”模块组装提示词预设（卡片块）时，系统提供了以下专属宏占位符。在发送请求时，它们会被解析为对应的上下文数据：</p>
                            
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
                        <!-- 复制目标 -->
                        <pre class="plot-copy-target" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
#### 幕后气泡对话区域 (Dialogue Area) CSS 类名及样式拆解

在编写自定义幕后主题样式时，可以使用以下详尽 of CSS 类名对气泡区域进行精细微调。此类名已拆分到最小 HTML 结构单位：

##### 1. 会话区域整体容器
*   \`.plot-bts-dialogue-area\`：对话气泡 of 父级纵向滚动区域容器 (&lt;div&gt;)。控制整体内边距 (padding: 15px)、滚动行为和泡泡垂直间距 (gap: 12px)。

##### 2. 消息单行外层布局 (Message Row)
*   \`.plot-bts-msg-row\`：包裹头像与气泡容器的单行外围盒子 (max-width: 85%)。
*   \`.plot-bts-msg-row.user\` / \`.plot-bts-msg-row.bot\`：用户发送消息行 (靠右对齐，反排列) 与 AI 发送消息行 (靠左对齐，正向排列)。
*   \`.plot-bts-msg-row.typing-indicator-row\` / \`.plot-bts-msg-row.temp-stream-row\`：AI 正在打字输出时的临时行级盒子。

##### 3. 头像与头像框组件
*   \`.plot-bts-avatar-wrapper\`：包裹头像和头像框 of 定位容器 (width: 38px; height: 38px;)。
*   \`.plot-bts-avatar\`：圆形头像图片元素 (&lt;img&gt;, border-radius: 50%)。
*   \`.plot-bts-avatar-frame\`：覆盖于头像上层 of 框架容器 (position: absolute; inset: -3px)。修饰类包含:
    *   \`.glowing-gold\`：金色发光呼吸特效。
    *   \`.glassmorphism\`：微白半透明毛玻璃框架。
    *   \`.neon-blue\`：霓虹科技蓝发光边框。

##### 4. 气泡复合容器 (Bubble Wrapper)
*   \`.plot-bts-bubble-container\`：包裹消息气泡本体和下方分页指示器 of 垂直容器。
*   \`.plot-bts-bubble\`：承载消息文本 and 悬浮工具栏 of 气泡主盒子。控制圆角 (border-radius: 12px)、padding 及默认阴影。
*   \`.plot-bts-bubble-text\`：承载具体文本内容 of 包裹器，内含 Markdown 生成 of 超链接 (a), 段落 (p), 代码块 (pre), 行内代码 (code)。

##### 5. 悬浮快捷工具栏
*   \`.plot-bts-bubble-actions\`：鼠标 Hover 时气泡底边浮现 of 工具栏容器 (position: absolute; bottom: -22px)。
*   \`.plot-bts-action-btn\`：工具栏中 of 各操作图标按钮。监听类包含:
    *   \`.plot-msg-edit\`：编辑并重发消息。
    *   \`.plot-msg-regenerate-user\`：快速重新生成 AI 回应。
    *   \`.plot-msg-retry\`：重新生成并覆盖当前 AI 回应。
    *   \`.plot-msg-swipe\`：追加生成新候选回复 (Swipe)。
    *   \`.plot-msg-modify\`：手动修改气泡内容。
    *   \`.plot-msg-delete\`：物理删除该条消息。

##### 6. Swipe 翻页面板与打字状态
*   \`.plot-bts-swipe-indicators\`：多分支气泡下方 of 翻页控制栏，含 \`.plot-swipe-prev\` (左翻页) 与 \`.plot-swipe-next\` (右翻页)。
*   \`.plot-bts-typing-indicator\`：打字等待状态下 of 三个跳动小圆点容器，内有 \`span\` 跳动圆点。

##### 7. 底部输入框与操作区域 (Bottom Input Area)
*   \`.plot-bts-input-area\`：底部输入区域容器 (&lt;div&gt;)。
*   \`.plot-bts-textarea\`：文本输入框/文本域 (&lt;textarea&gt;)。
*   \`.plot-bts-textarea::placeholder\`：文本输入框内 of 默认提示文字/占位符样式。
*   \`.plot-bts-send-btn\`：发送按钮 (&lt;button&gt;) 容器。
*   \`#plot-bts-send-icon\`：发送按钮内部 of 纸飞机图标元素 (&lt;i&gt;)。

##### 8. 消息气泡悬浮操作菜单 (Message Actions Menu)
*   \`.plot-bts-bubble-actions\`：Hover 悬浮操作菜单容器 (&lt;div&gt;)。
*   \`.plot-bts-action-btn\`：具体 of 操作按钮 (&lt;button&gt;) 样式。
*   \`.plot-bts-action-btn i\`：操作按钮内部 of FontAwesome 图标。
*   具体操作图标修饰类：
    *   \`.plot-msg-edit\`：编辑并重发消息图标。
    *   \`.plot-msg-regenerate-user\`：快速重新生成回复图标。
    *   \`.plot-msg-retry\`：重roll覆盖当前回复图标。
    *   \`.plot-msg-swipe\`：追加 Swipe 备选回复图标。
    *   \`.plot-msg-modify\`：手动修改气泡文字图标。
    *   \`.plot-msg-delete\`：物理删除该条消息图标。
                        </pre>
 
                         <!-- 展示目标 -->
                         <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                             <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">在编写自定义幕后主题 CSS 时，可使用以下结构类名进行精细样式定义：</p>
                             
                             <div style="display: flex; flex-direction: column; gap: 12px;">
                                 <div>
                                     <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. 会话区域整体容器</div>
                                     <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-dialogue-area</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">气泡总容器 (<code>&lt;div&gt;</code>)，控制内边距、滚动行为与泡泡间距。</div>
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

                                 <div>
                                     <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">7. 底部输入框与操作区域 (Bottom Input Area)</div>
                                     <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-input-area</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">底部输入区域整体外围容器 (<code>&lt;div&gt;</code>)。</div>
                                         </li>
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-textarea</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-textarea::placeholder</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">文本输入框 textarea 及其中默认占位提示文字样式。</div>
                                         </li>
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-send-btn</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">#plot-bts-send-icon</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">发送按钮 (<code>&lt;button&gt;</code>) 与内部纸飞机图标样式。</div>
                                         </li>
                                     </ul>
                                 </div>

                                 <div>
                                     <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">8. 消息气泡悬浮操作菜单 (Message Actions Menu)</div>
                                     <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-bubble-actions</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-action-btn</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">气泡 Hover 时出现的悬浮操作菜单容器与内部按钮样式。</div>
                                         </li>
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-action-btn i</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">操作按钮内部的图标 (例如编辑、重roll、删除等图标) 样式。</div>
                                         </li>
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-msg-edit</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-msg-regenerate-user</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-msg-retry</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">用户消息编辑并重发、快速重生成、AI 回复覆盖重roll动作修饰类。</div>
                                         </li>
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-msg-swipe</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-msg-modify</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-msg-delete</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">追加 Swipe 回复、手动无痕修改内容、删除消息动作修饰类。</div>
                                         </li>
                                     </ul>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>

            </div>

            <!-- 面板 2: 目标与注入教程 -->
            <div id="plot-help-pane-goals" class="plot-help-pane" style="display: none; flex-direction: column; gap: 10px;">
                
                <!-- 第一部分：全局与各模块注入占位符 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-earth-americas"></i> <span>第一部分：全局注入模板与全局宏</span>
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="plot-btn plot-copy-btn" style="padding: 2px 8px; font-size: 0.8em; height: 24px; display: flex; align-items: center; gap: 4px;" title="复制本部分内容">
                                <i class="fa-solid fa-copy"></i> 复制
                            </button>
                            <i class="fa-solid fa-chevron-right plot-fold-icon" style="transition: transform 0.2s; font-size: 0.85em;"></i>
                        </div>
                    </div>
                    <div class="plot-tutorial-body" style="padding: 12px; display: none; font-size: 0.82em; line-height: 1.6; border-top: 1px solid var(--SmartThemeBorderColor); background: transparent;">
                        <!-- 复制目标 -->
                        <pre class="plot-copy-target" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
#### 剧情状态全局注入占位符与全局宏 (Global Injection & Macros)

##### 1. SillyTavern 级别全局宏 (可放在角色卡设定/世界书/全局系统提示词中)
*   {{plot_state}}
    *   **概述**：经过“全局注入模板”格式化后的完整剧情状态包装大块（内含变量、目标、故事线等激活模块的合并内容）。
*   {{plot_goals}}
    *   **概述**：仅经过目标模块内部注入模板（如主聊天注入大模板和行模板）展开后的任务目标文本。

##### 2. 全局注入模板占位符 (可在 设置 -> 全局注入模板 中配置)
*   {{goals}}
    *   **概述**：代表目标 (Goals) 模块的全部渲染文本。若目标模块开启了自定义注入，则解析为自定义大模板渲染出的任务列表；否则退回到行内简单格式。
*   {{variables}}
    *   **概述**：代表变量 (Variables) 状态的序列化文本（例如“好感度: 80, 金钱: 50”）。
*   {{storylines}}
    *   **概述**：代表故事线 (Storylines) 状态的序列化文本。
*   **注**：任何被关闭的模块所占用的整行占位符文本都会被自动删去，不会在大模型提示词中留下空行或废弃前缀。
                        </pre>

                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">用于全局注入模板或 SillyTavern 全局宏中，控制整套剧情状态在上下文中的格式及顺序：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. SillyTavern 级别全局宏</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_state}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>完整剧情状态包装大块，在主对话触发时自动追加在最后一条用户消息末尾，也可手动写在卡片设定或系统提示词中自由定位（需将注入模式设为 macro）。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>单独引用目标模块的内容（格式同样受目标配置抽屉的模板控制）。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">2. 全局注入模板占位符</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{goals}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>作用：</strong>引入渲染好的目标模块文本块。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{variables}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>作用：</strong>引入序列化后的变量值。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{storylines}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>作用：</strong>引入故事线分支进度描述。</div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 第二部分：目标大模板与单行模板宏 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-list-check"></i> <span>第二部分：目标专属容器模板与单行模板宏</span>
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="plot-btn plot-copy-btn" style="padding: 2px 8px; font-size: 0.8em; height: 24px; display: flex; align-items: center; gap: 4px;" title="复制本部分内容">
                                <i class="fa-solid fa-copy"></i> 复制
                            </button>
                            <i class="fa-solid fa-chevron-right plot-fold-icon" style="transition: transform 0.2s; font-size: 0.85em;"></i>
                        </div>
                    </div>
                    <div class="plot-tutorial-body" style="padding: 12px; display: none; font-size: 0.82em; line-height: 1.6; border-top: 1px solid var(--SmartThemeBorderColor); background: transparent;">
                        <!-- 复制目标 -->
                        <pre class="plot-copy-target" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
#### 目标专属容器模板与单行模板宏 (Goals Sub-Templates & Field Macros)

##### 1. 主聊天注入大模板 (可以在“配置目标模块选项”的“注入”Tab 中编辑)
*   {{plot_goals_active}}
    *   **概述**：所有处于进行中 (Active) 且**非针定**的目标任务列表。列表每行会通过“默认行模板”进行格式化。
*   {{plot_goals_pinned}}
    *   **概述**：已被用户针定 (Pinned) 的进行中目标任务列表（每行亦会使用行模板）。开启自定义注入大模板后，针定任务默认不会强行追加在末尾，必须使用此占位符显式引入。
*   {{plot_goals_complete}}
    *   **概述**：所有状态为已完成 (Complete) 的任务列表。
*   {{plot_goals_failed}}
    *   **概述**：所有状态为已失败 (Failed) 的任务列表。
*   {{plot_goals_all}}
    *   **概述**：当前拥有的全部任务列表。

##### 2. 默认行模板 (控制任务在列表中呈现的单行格式)
*   {{title}}
    *   **概述**：任务标题。
*   {{desc}}
    *   **概述**：任务具体描述内容。
*   {{status}}
    *   **概述**：任务状态值（active, complete, failed, hidden）。
*   {{type}}
    *   **概述**：任务达成判定类型（manual, variable, keyword, ai）。
*   自定义属性字段 (如 {{reward}} / {{clue}})
    *   **概述**：若你在目标单任务抽屉的“自定义属性”中新增了某属性，你可在行模板中直接使用其对应的英文键名作为占位符。解析时会自动被替换为该目标的具体属性值。
                        </pre>

                        <!-- 展示目标 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">用于目标模块内部的“双层模板”设计，精细控制任务列表在大模型面前的展示形态：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. 主聊天注入大模板占位符</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_active}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>作用：</strong>渲染普通进行中的任务列表。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_pinned}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>作用：</strong>渲染已被用户置顶/针定的持续任务列表。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_complete}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_failed}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>作用：</strong>渲染已完成或已失败的任务历史列表。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">2. 默认行模板占位符与自定义属性</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{title}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{desc}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">代表当前任务行对应的标题与具体描述内容。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{status}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{type}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">代表当前任务状态（进行中/已完成/已失败）与判定类型（手动/变量/关键词/智能）。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{自定义属性名}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>重要特性：</strong>如果在目标的“自定义属性”中新建了项（如 <code>reward</code>: 金币x100），在行模板中写 <code>{{reward}}</code> 将会自动替换展示为“金币x100”，赋予极高的可扩展性。</div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 第三部分：目标模块高级特性：自定义属性与徽章映射 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden; margin-top: 10px;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-tags"></i> <span>第三部分：目标模块高级特性：自定义属性与徽章映射</span>
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="plot-btn plot-copy-btn" style="padding: 2px 8px; font-size: 0.8em; height: 24px; display: flex; align-items: center; gap: 4px;" title="复制本部分内容">
                                <i class="fa-solid fa-copy"></i> 复制
                            </button>
                            <i class="fa-solid fa-chevron-right plot-fold-icon" style="transition: transform 0.2s; font-size: 0.85em;"></i>
                        </div>
                    </div>
                    <div class="plot-tutorial-body" style="padding: 12px; display: none; font-size: 0.82em; line-height: 1.6; border-top: 1px solid var(--SmartThemeBorderColor); background: transparent;">
                        <!-- 复制目标 -->
                        <pre class="plot-copy-target" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
#### 目标模块高级特性：自定义属性与徽章映射 (Custom Fields & Badge Mapping)

##### 1. 自定义属性的用法
在新建或编辑某个剧情目标（点击单个任务）时，您可以为该目标自由添加专属的自定义扩展键值对（例如：英文键名设为 reward，值设为 金币x100；或键名设为 clue，值设为 染血的钥匙）。
在提示词注入中应用：一旦添加了自定义属性，您就可以在模式配置的“默认行模板”中，直接使用包裹在双大括号中的英文键名作为占位符（例如：【{{title}}】奖励: {{reward}}）。系统在拼接提示词发送给 AI 时，会自动将其替换为具体的任务属性（若某任务无此属性，则该占位符解析为空白）。这能非常智能地将任务所关联的内容、线索和惩罚机制精确传递给大模型。

##### 2. 自定义徽章映射与颜色配置
UI 视觉强化：在目标主面板上，添加了自定义属性的任务会自动在标题下方渲染为醒目的小徽章（Badge），显示为 [标签名]: [内容]。
默认别名映射：系统默认对以下常用键名做好了汉化映射和配色：
*   reward / rewards / awards ➜ 映射为“奖励”
*   innerVoice ➜ 映射为“心声”
*   exp ➜ 映射为“经验”
*   clue ➜ 映射为“线索”
自定义颜色与标签：通过点击模块齿轮打开设置，在“显示 (Display)”选项卡下，可以找到“自定义徽章映射与颜色”。
*   您可以添加全新的映射规则。例如，在“属性键值”输入 difficulty，“徽章名称”输入 挑战难度，并为其选择红色。
*   这样，若任务中添加了 difficulty: 极难 属性，主面板上就会完美呈现出一个红色的“挑战难度: 极难”徽章，使任务界面和状态一目了然！
                        </pre>

                        <!-- 展示目标 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">掌握自定义属性与徽章映射的高级特性，为 AI 提供富文本剧情上下文，并打造个性化的任务主面板看板：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. 自定义属性的用法</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <strong>创建与扩展：</strong>在编辑具体任务时，可在底部“自定义属性”点击添加键值对。例如，您可以为战斗任务添加键名 <code>reward</code> 值为 <code>金币x100</code>；或者添加键名 <code>limit</code> 值为 <code>3回合内</code>。
                                        </li>
                                        <li>
                                            <strong>动态行模板渲染：</strong>在配置目标模式的“默认行模板”时，直接使用双大括号包含该键名（例如 <code>{{reward}}</code>、<code>{{limit}}</code>）作为占位符。系统格式化发送给 AI 时，会自动将其解析替换为实际属性，让大模型在了解任务的同时，精确获知任务完成的奖励或时间限制。
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">2. 自定义徽章映射与颜色配置</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <strong>看板小徽章 (Badge)：</strong>配置了自定义属性的任务，其属性会自动作为独立微标展示在任务标题下方。
                                        </li>
                                        <li>
                                            <strong>系统内置别名：</strong>系统对以下常见扩展属性已内置了汉化标签名与亮色配色：
                                            <div style="margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap;">
                                                <span style="font-size: 0.85em; padding: 1px 4px; border-radius: 3px; background: rgba(0,0,0,0.15); border: 1px solid var(--SmartThemeEmColor); color: var(--SmartThemeEmColor); font-weight: bold;">奖励 (reward)</span>
                                                <span style="font-size: 0.85em; padding: 1px 4px; border-radius: 3px; background: rgba(0,0,0,0.15); border: 1px solid var(--SmartThemeEmColor); color: var(--SmartThemeEmColor); font-weight: bold;">心声 (innerVoice)</span>
                                                <span style="font-size: 0.85em; padding: 1px 4px; border-radius: 3px; background: rgba(0,0,0,0.15); border: 1px solid var(--SmartThemeEmColor); color: var(--SmartThemeEmColor); font-weight: bold;">经验 (exp)</span>
                                                <span style="font-size: 0.85em; padding: 1px 4px; border-radius: 3px; background: rgba(0,0,0,0.15); border: 1px solid var(--SmartThemeEmColor); color: var(--SmartThemeEmColor); font-weight: bold;">线索 (clue)</span>
                                            </div>
                                        </li>
                                        <li>
                                            <strong>自定义标签与色彩：</strong>在目标齿轮的“显示 (Display)”标签页下，找到“自定义徽章映射与颜色”。添加映射规则后，可为任意属性键值（如 <code>difficulty</code>）绑定汉化微标文本（如 <code>难度</code>）并定制特定的霓虹边框颜色。面板会立即刷新呈现出高颜值的任务状态！
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <!-- 面板 3: 变量与触发器教程 -->
            <div id="plot-help-pane-variables" class="plot-help-pane" style="display: none; flex-direction: column; gap: 10px;">
                <!-- 第一部分：批量导入参考 Prompt -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-code"></i> <span>变量 AI 生成与提取 Prompt 参考</span>
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="plot-btn plot-copy-btn" style="padding: 2px 8px; font-size: 0.8em; height: 24px; display: flex; align-items: center; gap: 4px;" title="复制 Prompt">
                                <i class="fa-solid fa-copy"></i> 复制
                            </button>
                            <i class="fa-solid fa-chevron-right plot-fold-icon" style="transition: transform 0.2s; font-size: 0.85em;"></i>
                        </div>
                    </div>
                    <div class="plot-tutorial-body" style="padding: 12px; display: none; font-size: 0.82em; line-height: 1.6; border-top: 1px solid var(--SmartThemeBorderColor); background: transparent;">
                        <!-- 复制目标 -->
                        <pre class="plot-copy-target" style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
你是一个专业的 TRPG 跑团后台规划助手。请阅读我们之间的所有聊天历史，分析角色的当前状态、人设进展、好感态度和场景变量。
请为我生成一个可以直接粘贴到变量系统中的变量键值对列表。
格式要求：
- 每一行代表一个变量，格式为“变量名: 值”
- 变量值必须是数字（如 50）、布尔值（如 true 或 false）或纯文本
- 不要输出多余的解释、Markdown 标记或空行。

输出示例：
好感度: 65
信任度: 40
警惕度: 20
是否知晓真相: false
当前位置: 地下酒馆
                        </pre>
                        <!-- 展示目标 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">您可以复制以下提示词，发送给任意大语言模型，让 AI 帮您快速生成变量配置，并直接在“批量导入”功能中粘贴添加：</p>
                            <div style="background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 4px; border: 1px solid var(--SmartThemeBorderColor); font-family: monospace; font-size: 0.9em; white-space: pre-wrap; color: var(--SmartThemeEmColor);">
你是一个专业的 TRPG 跑团后台规划助手。请阅读我们之间的所有聊天历史，分析角色的当前状态、人设进展、好感态度和场景变量。
请为我生成一个可以直接粘贴到变量系统中的变量键值对列表。
格式要求：
- 每一行代表一个变量，格式为“变量名: 值”
- 变量值必须是数字（如 50）、布尔值（如 true 或 false）或纯文本
- 不要输出多余的解释、Markdown 标记或空行。

输出示例：
好感度: 65
信任度: 40
警惕度: 20
是否知晓真相: false
当前位置: 地下酒馆
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 第二部分：触发器条件编写与动作配置 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-bolt"></i> <span>触发器 (Triggers) 编写与联动动作</span>
                        </span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <i class="fa-solid fa-chevron-right plot-fold-icon" style="transition: transform 0.2s; font-size: 0.85em;"></i>
                        </div>
                    </div>
                    <div class="plot-tutorial-body" style="padding: 12px; display: none; font-size: 0.82em; line-height: 1.6; border-top: 1px solid var(--SmartThemeBorderColor); background: transparent;">
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                <li>
                                    <strong>条件表达式：</strong>编写 JavaScript 条件表达式来触发联动。可以使用特殊关键字 <code>value</code> 引用本变量当前值，也可以直接使用其他变量的 ID 标识（如 <code>trust</code>）。例如：<code>value >= 80 && trust >= 50</code>。
                                </li>
                                <li>
                                    <strong>一次性触发 (Once)：</strong>条件在聊天过程中首次满足时，立即执行且仅执行一次所有关联动作。
                                </li>
                                <li>
                                    <strong>持续生效 (Persistent)：</strong>当变量值被修改满足条件时，触发“激活提示词”等动作；当变量值再次降低或修改不再满足条件时，自动取消该提示词注入。
                                </li>
                                <li>
                                    <strong>解锁/完成目标：</strong>当触发器满足时，可以级联修改“目标/任务”模块的对应任务状态，实现例如“好感度大于 80 时，解锁隐藏任务：【表白心意】”的联动效果。
                                </li>
                                <li>
                                    <strong>提示词注入方式 (可选发送方式)：</strong>
                                    <ul style="margin: 4px 0 0 12px; padding-left: 12px; list-style-type: circle; display: flex; flex-direction: column; gap: 4px;">
                                        <li><strong>系统层 (System)：</strong>提示词作为独立的系统规则附加在整个 <code>[剧情状态]</code> 的尾部。</li>
                                        <li><strong>变量尾 (Variable)：</strong>提示词会作为该变量的括号描述直接合并在序列化文本中注入。如：<code>好感度: 85 (对玩家非常信任，开始倾诉秘密)</code>。</li>
                                    </ul>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `;

    console.log('[Plot Help] setting innerHTML, length:', htmlStr.length);
    containerEl.innerHTML = htmlStr;
    console.log('[Plot Help] containerEl children count:', containerEl.children.length);
    
    const wrapper = containerEl.querySelector('.plot-tutorial-wrapper');
    if (wrapper) {
        console.log('[Plot Help] wrapper children count:', wrapper.children.length);
        Array.from(wrapper.children).forEach((child, idx) => {
            const computedStyle = window.getComputedStyle(child);
            console.log(`[Plot Help] Wrapper Child ${idx}:`, {
                tag: child.tagName,
                id: child.id,
                classes: child.className,
                display: computedStyle.display
            });
            
            // Log sub-children of the pane to see if sections are present
            if (child.classList.contains('plot-help-pane')) {
                console.log(`[Plot Help]   Pane "${child.id}" child count:`, child.children.length);
                Array.from(child.children).forEach((sec, sIdx) => {
                    const secStyle = window.getComputedStyle(sec);
                    console.log(`[Plot Help]     Sec ${sIdx}:`, {
                        tag: sec.tagName,
                        classes: sec.className,
                        display: secStyle.display
                    });
                });
            }
        });
        
        console.log('[Plot Help] document has backstage pane:', !!document.getElementById('plot-help-pane-backstage'));
        console.log('[Plot Help] document has goals pane:', !!document.getElementById('plot-help-pane-goals'));
    } else {
        console.warn('[Plot Help] .plot-tutorial-wrapper not found in DOM!');
    }

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

    // 3. 三级 Tab 切换逻辑
    const helpTabs = containerEl.querySelectorAll('#plot-help-tabs .plot-sub-tab');
    helpTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            helpTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetPaneId = 'plot-help-pane-' + tab.dataset.helptab;
            containerEl.querySelectorAll('.plot-help-pane').forEach(pane => {
                pane.style.display = pane.id === targetPaneId ? 'flex' : 'none';
            });
        });
    });
}
