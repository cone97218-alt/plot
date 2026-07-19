export function renderTutorial(containerEl) {
    console.log('[Plot Help] Fresh tutorial rendering triggered.');
    const htmlStr = `
        <div class="plot-tutorial-wrapper" style="padding: 10px 5px; display: flex; flex-direction: column; gap: 12px; color: var(--SmartThemeBodyColor); box-sizing: border-box;">
            
            <!-- 三级 Tab 导航栏 -->
            <div class="plot-sub-tab-bar" id="plot-help-tabs" style="display: flex !important; margin-bottom: 0px !important; padding-bottom: 0px !important; border-bottom: 1px solid var(--SmartThemeBorderColor) !important; flex-shrink: 0 !important; gap: 0px !important;">
                <button class="plot-sub-tab active" data-helptab="general" style="display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeEmColor); font-weight: bold; border-radius: 4px; padding: 4px 10px; font-size: 0.85em; margin-bottom: 0px !important;">
                    <i class="fa-solid fa-earth-americas"></i> <span>基础</span>
                </button>
                <button class="plot-sub-tab" data-helptab="backstage" style="display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeEmColor); font-weight: bold; border-radius: 4px; padding: 4px 10px; font-size: 0.85em; margin-bottom: 0px !important; margin-left: 8px !important;">
                    <i class="fa-solid fa-masks-theater"></i> <span>幕后</span>
                </button>
                <button class="plot-sub-tab" data-helptab="goals" style="display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeEmColor); font-weight: bold; border-radius: 4px; padding: 4px 10px; font-size: 0.85em; margin-bottom: 0px !important; margin-left: 8px !important;">
                    <i class="fa-solid fa-clipboard-list"></i> <span>目标</span>
                </button>
                <button class="plot-sub-tab" data-helptab="variables" style="display: flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--SmartThemeBorderColor); color: var(--SmartThemeEmColor); font-weight: bold; border-radius: 4px; padding: 4px 10px; font-size: 0.85em; margin-bottom: 0px !important; margin-left: 8px !important;">
                    <i class="fa-solid fa-sliders"></i> <span>变量</span>
                </button>
            </div>

            <!-- 面板 0: 通用教程 -->
            <div id="plot-help-pane-general" class="plot-help-pane" style="display: flex; flex-direction: column; gap: 10px;">
                
                <!-- 第一部分：全局通用宏与占位符 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-earth-americas"></i> <span>1. 全局通用占位符</span>
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

                <!-- 第二部分：剧情模块全局宏 (Plot Macros) -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden; margin-top: 10px;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-sliders"></i> <span>2. 剧情全局宏</span>
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
#### SillyTavern 剧情全局宏 (SillyTavern Plot Macros)

这些宏可以写在角色卡设定、世界书条目、系统提示词（System Prompt）等 SillyTavern 自身的任何文本输入框中。在主会话聊天时由 SillyTavern 核心引擎解析：

*   {{plot_state}}
    *   **概述**：经过“全局注入模板”格式化后的完整剧情状态包（包含当前活跃的任务、变量、故事线等）。
    *   **作用**：如果您使用“宏注入模式（Macro Mode）”，请在角色设定或作者注释中插入此宏。
*   {{plot_variables}}
    *   **概述**：单独引用的全部变量值列表。
*   {{plot_goals}}
    *   **概述**：单独引用的任务列表。
*   {{plot_storyline}}
    *   **概述**：单独引用的故事线进度描述。
*   {{plot_goals_active}}
    *   **概述**：所有“进行中（活跃）”任务构成的树状列表。
*   {{plot_goals_complete}}
    *   **概述**：所有“已完成”任务构成的树状列表。
*   {{plot_goals_failed}}
    *   **概述**：所有“已失败”任务构成的树状列表。
*   {{plot_goals_all}}
    *   **概述**：包含全部状态的任务树状列表。
*   {{plot_var_ID}}
    *   **概述**：动态引用指定 ID 变量的值。
*   {{plot_var_ID_tree}}
    *   **概述**：以树状 JSON 格式引用特定 ID 的复杂变量值。
*   {{plot_var_ID_line}}
    *   **概述**：以单行格式 \`- name: value\` 引用并格式化指定 ID 的变量。
                        </pre>

                        <!-- 展示目标 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">以下是剧情模块注册在 SillyTavern 中的全局宏，可用在角色卡、提示词或世界书中实现精准状态同步：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_state}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>整合所有激活子模块的完整剧情状态包文本。</div>
                                            <div style="opacity: 0.75; font-size: 0.9em;"><strong>作用：</strong>宏注入模式下，请在角色卡人设、作者注释或系统提示词中写入该占位符。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_variables}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_storyline}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>单独引用全部变量列表或故事线进度描述。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>仅获取格式化后的任务模块文本。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_active}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_complete}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_failed}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_hidden}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_all}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>不同状态（进行中、已完成、已失败、已隐藏、全部）任务构成的树状列表。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_var_ID}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_var_ID_tree}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_var_ID_line}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>概述：</strong>动态引用特定变量值（使用时将 ID 替换为具体的变量 ID）。支持原始值、缩进树状结构与单行格式。</div>
                                            <div style="opacity: 0.75; font-size: 0.90em;"><strong>示例：</strong><code>{{plot_var_gold}}</code> 展开为金币变量值；<code>{{plot_var_bag_tree}}</code> 展开为背包对象树。</div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 第三部分：宏包含关系与嵌套指南 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden; margin-top: 10px;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-sitemap"></i> <span>3. 宏包含与嵌套关系指南 (带实例)</span>
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
#### 宏包含关系与嵌套指南 (Nesting Macros & Examples)

整个剧情模块的宏解算像一个嵌套的“俄罗斯套娃”包装盒：

##### 1. 俄罗斯套娃包含树 (Hierarchy)
- {{plot_state}} (最外层大盒子)
  - ├── {{goals}} (目标大模块模板)
  |      └── {{plot_goals_active}} (任务循环)
  |             └── {{title}}, {{desc}}, {{reward}} (单行模板属性)
  - ├── {{variables}} (变量列表)
  - └── {{storylines}} (故事线进度)

##### 2. 真实嵌套解算实例 (Walkthrough Example)

当您在酒馆系统提示词中写入：
\`{{plot_state}}\`

它的展开和解析过程如下：

【第一层：大盒子解算】
\`{{plot_state}}\` 触发后，会读取并填充“全局注入模板”（默认内容为 \`[剧情状态]\n{{goals}}\n[/剧情状态]\`）。
输出替换为：
[剧情状态]
{{goals}}
[/剧情状态]

【第二层：子模块模板解算】
接下来，中间的 \`{{goals}}\` 会被展开为“任务目标模块大模板”（例如：\`当前任务列表：\n{{plot_goals_active}}\`）。
输出替换为：
[剧情状态]
当前任务列表：
{{plot_goals_active}}
[/剧情状态]

【第三层：任务列表解算】
接下来，系统会遍历所有活跃任务，对每一个活跃任务利用“默认行模板”（例如 \`* 【{{title}}】{{desc}} 奖励: {{reward}}\`）进行格式化并合并。
若我们有一条任务 “夺回钥匙”，描述为 “击败城堡小丑获得钥匙”，自定义属性 “reward” 为 “红宝石x1”，则该条任务格式化后为：
\`* 【夺回钥匙】击败城堡小丑获得钥匙 奖励: 红宝石x1\`

【第四层：最终合并输出】
AI 在 API 后端接收到的最终文本包：
[剧情状态]
当前任务列表：
* 【夺回钥匙】击败城堡小丑获得钥匙 奖励: 红宝石x1
[/剧情状态]
                        </pre>

                        <!-- 展示目标 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">了解各个宏之间的“俄罗斯套娃”嵌套解算规则与层级归属：</p>
                            
                            <div style="background: rgba(0,0,0,0.15); padding: 8px 12px; border-radius: 4px; border: 1px dashed var(--SmartThemeBorderColor); margin-bottom: 10px; font-family: monospace; font-size: 0.9em; line-height: 1.5; color: var(--SmartThemeEmColor);">
                                <strong>{{plot_state}}</strong> (最外层状态大包)<br>
                                ├── <strong>{{goals}}</strong> (目标大模块模板)<br>
                                │&nbsp;&nbsp;&nbsp; └── <strong>{{plot_goals_active}}</strong> (过滤后的活跃任务)<br>
                                │&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; └── <strong>{{title}}</strong>, <strong>{{desc}}</strong>, <strong>{{自定义属性}}</strong> (单行属性映射)<br>
                                ├── <strong>{{variables}}</strong> (变量模块模板)<br>
                                └── <strong>{{storylines}}</strong> (故事线描述)
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">解析全生命周期示例：</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <strong>第一步 (引用大包)：</strong>您在角色卡或人设中写下 <code>{{plot_state}}</code>。
                                        </li>
                                        <li>
                                            <strong>第二步 (解析大包装盒)：</strong>大包加载默认“全局注入大模板”，得到：
                                            <pre style="background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 3px; font-size: 0.95em; margin: 4px 0;">[剧情状态]\n{{goals}}\n[/剧情状态]</pre>
                                        </li>
                                        <li>
                                            <strong>第三步 (解算模块模板)：</strong><code>{{goals}}</code> 占位符按“目标大模板”替换，生成：
                                            <pre style="background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 3px; font-size: 0.95em; margin: 4px 0;">[剧情状态]\n当前任务：\n{{plot_goals_active}}\n[/剧情状态]</pre>
                                        </li>
                                        <li>
                                            <strong>第四步 (解算任务属性)：</strong><code>{{plot_goals_active}}</code> 进行任务循环。每个任务根据默认行模板 <code>* 【{{title}}】描述: {{desc}} 奖励: {{reward}}</code> 进行循环拼装。最终渲染出以下完美文本送往大模型：
                                            <pre style="background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 3px; font-size: 0.95em; margin: 4px 0; color: var(--SmartThemeEmColor);">[剧情状态]
当前任务：
* 【夺回钥匙】描述: 击败城堡小丑获得钥匙 奖励: 红宝石x1
[/剧情状态]</pre>
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
                            <i class="fa-solid fa-code"></i> <span>1. 幕后专属占位符</span>
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

                <!-- 第二部分：全系统宏与占位符分类及使用场景指南 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden; margin-top: 10px;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-circle-info"></i> <span>2. 全局宏与占位符指南</span>
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
#### 全系统宏与占位符分类及使用场景指南 (Macros & Placeholders Reference)

为了避免解析冲突和递归调用，系统的宏和占位符按照使用场景（即“谁在何时进行解析”）进行了严格分类：

##### 1. SillyTavern 级别全局宏
*   **使用场景**：可以写在角色卡设定、世界书条目、系统提示词（System Prompt）等 SillyTavern 自身的任何文本输入框中。在主会话聊天时由 SillyTavern 核心引擎解析。
*   **可用宏**：
    *   \`{{plot_state}}\`：经过“全局注入模板”格式化后的完整剧情状态包。
    *   \`{{plot_variables}}\`：单独引用的全部变量值。
    *   \`{{plot_goals}}\`：单独引用的任务列表（退回平铺或通过注入大模板格式化）。
    *   \`{{plot_storyline}}\`：单独引用的故事线进度描述。
    *   \`{{plot_goals_active}}\`：所有“进行中（活跃）”任务构成的树状列表。
    *   \`{{plot_goals_complete}}\`：所有“已完成”任务构成的树状列表。
    *   \`{{plot_goals_failed}}\`：所有“已失败”任务构成的树状列表。
    *   \`{{plot_goals_hidden}}\`：所有“已隐藏”任务构成的树状列表。
    *   \`{{plot_goals_all}}\`：包含全部状态（进行中、已完成、已失败、已隐藏）的任务树状列表。

##### 2. 全局注入模板占位符
*   **使用场景**：仅在“扩展设置 ➜ 全局注入模板”中配置，控制 \`{{plot_state}}\` 宏被触发时内部各模块的拼装顺序。
*   **可用占位符**：
    *   \`{{goals}}\`：任务目标模块整体。
    *   \`{{variables}}\`：变量状态模块整体。
    *   \`{{storylines}}\`：故事线进度模块整体。
                        </pre>

                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">以下为全系统全局宏与全局注入占位符分类指南：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. SillyTavern 级别全局宏（适用于角色卡、系统提示词、世界书）</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_state}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">经过“全局注入模板”拼装的完整剧情状态包。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_variables}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_storyline}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">单独引用全部变量值或故事线进度描述。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">仅任务模块内容（根据目标大模板格式化，未开启时退回行内平铺）。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_active}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_complete}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_failed}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_hidden}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_all}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">对应状态的任务树形 Markdown 列表。</div>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">2. 全局注入模板占位符（仅用于 齿轮设置 -> 全局注入模板）</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{goals}}</code> / <code>{{variables}}</code> / <code>{{storylines}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">代表各独立模块渲染出来的文本，用以自定义剧情状态包的拼接顺序和包裹结构。</div>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 第三部分：CSS 类名 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-palette"></i> <span>3. 幕后气泡区 CSS 类名</span>
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
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">底部输入区域整体外围容器 (&lt;div&gt;)。</div>
                                         </li>
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-textarea</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-textarea::placeholder</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">文本输入框 textarea 及其中默认占位提示文字样式。</div>
                                         </li>
                                         <li>
                                             <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">.plot-bts-send-btn</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">#plot-bts-send-icon</code>
                                             <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">发送按钮 (&lt;button&gt;) 与内部纸飞机图标样式。</div>
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
                
                <!-- 第一部分：目标专属容器模板与单行模板宏 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden; margin-top: 10px;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-list-check"></i> <span>1. 任务容器与行模板</span>
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
* {{plot_goals_active}}
    * 概述：所有处于进行中 (Active) 且非钉选的目标任务列表。列表每行会通过“默认行模板”进行格式化。
* {{plot_goals_pinned}}
    * 概述：已被用户钉选 (Pinned) 的进行中目标任务列表（每行亦会使用行模板）。开启自定义注入大模板后，钉选任务默认不会强行追加在末尾，必须使用此占位符显式引入。
* {{plot_goals_complete}}
    * 概述：所有状态为已完成 (Complete) 的任务列表。
* {{plot_goals_failed}}
    * 概述：所有状态为已失败 (Failed) 的任务列表。
* {{plot_goals_hidden}}
    * 概述：所有状态为已隐藏 (Hidden) 的任务列表。
* {{plot_goals_all}}
    * 概述：当前拥有的全部任务列表（包含所有状态类型）。

##### 2. 默认行模板 (控制任务在列表中呈现的单行格式)
* {{title}}
    * 概述：任务标题。
* {{desc}}
    * 概述：任务具体描述内容。
* {{status}}
    * 概述：任务状态值（active, complete, failed, hidden）。
* {{type}}
    * 概述：任务达成判定类型（manual, variable, keyword, ai）。
* 自定义属性字段 (如 {{reward}} / {{clue}})
    * 概述：若你在目标单任务抽屉的“自定义属性”中新增了某属性，你可在行模板中直接使用其对应的英文键名作为占位符。解析时会自动被替换为该目标的具体属性值。
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
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_complete}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_failed}}</code> / <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_hidden}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>作用：</strong>渲染已完成、已失败或已隐藏的任务历史列表。</div>
                                        </li>
                                        <li>
                                            <code style="color: var(--SmartThemeEmColor); font-weight: bold; background: rgba(var(--SmartThemeChatTintColor-rgb), 0.5); padding: 1px 5px; border-radius: 3px; font-family: monospace;">{{plot_goals_all}}</code>
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;"><strong>作用：</strong>渲染全部已登记的任务列表（包含所有状态类型）。</div>
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
                                            <div style="opacity: 0.8; font-size: 0.92em; margin-top: 2px;">代表当前任务状态（进行中/已完成/已失败/已隐藏）与判定类型（手动/变量/关键词/智能）。</div>
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

                <!-- 第二部分：目标模块高级特性：自定义属性与徽章映射 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden; margin-top: 10px;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-tags"></i> <span>2. 自定义属性与徽章</span>
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
* reward / rewards / awards ➜ 映射为“奖励”
* innerVoice ➜ 映射为“心声”
* exp ➜ 映射为“经验”
* clue ➜ 映射为“线索”
自定义颜色与标签：通过点击模块齿轮打开设置，在“显示 (Display)”选项卡下，可以找到“自定义徽章映射与颜色”。
* 您可以添加全新的映射规则。例如，在“属性键值”输入 difficulty，“徽章名称”输入 挑战难度，并为其选择红色。
* 这样，若任务中添加了 difficulty: 极难 属性，主面板上就会完美呈现出一个红色的“挑战难度: 极难”徽章，使任务界面和状态一目了然！
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

                <!-- 三部分：任务置顶（图钉钉选）与注入解算机制说明 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden; margin-top: 10px;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-thumbtack"></i> <span>3. 任务置顶与注入机制</span>
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
#### 任务置顶（图钉钉选）与注入解算机制说明 (Pinning & Injection Logic)

在目标卡片上点击“图钉（钉选）”按钮后，该活跃任务会进入置顶分组。这在大模型提示词注入解算时有如下的核心分类表现：

##### 1. 全局注入开启，goals 注入未开启时（旧版简易行内平铺）
*   **发送行为**：正常发送。
*   **渲染机制**：此状态下目标数据以简易的单行平铺格式发送，不受“默认行模板”控制，固定显示为 \`[进行中] 任务标题\`。此时不会区分钉选状态，钉选的任务依旧会和其他活跃任务一起平铺在列表里发给大模型。

##### 2. 全局注入开启，goals 注入开启时（新版精细宏模式）
*   **发送行为**：**视注入模板而定**。
*   **渲染机制**：为了提供更高的提示词控制权，钉选活跃任务会**自动从普通宏 \`{{plot_goals_active}}\` 中剔除**，并转移到独立的置顶专用宏 \`{{plot_goals_pinned}}\` 中。
*   **注意事项**：如果您使用系统默认的大模板（仅包含 \`{{plot_goals_active}}\`），在您勾选钉选任务后，由于该任务被剔除而又未被 \`{{plot_goals_pinned}}\` 承接，它将不会被发给大模型。**建议将注入大模板修改为同时包含这两个宏的结构**（例如：置顶核心目标:\\n{{plot_goals_pinned}}\\n\\n普通目标:\\n{{plot_goals_active}}）。

##### 3. 全局注入未开启，goals 注入未开启时（未注册自动注入）
*   **发送行为**：默认不发送。但如果用户手动在角色设定、系统提示词或世界书中引用了 \`{{plot_goals}}\` 或 \`{{plot_state}}\` 等 SillyTavern 全局宏，它们依然会被替换渲染。此时由于 goals 详细注入没有打开，同样会调用行内平铺概览（包含所有钉选与未钉选的活跃任务）。
                        </pre>

                        <!-- 展示目标 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">了解置顶目标（钉选）在不同注入配置状态下的流向和处理方式，避免提示词断档：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. 全局注入开启，goals 注入未开启（行内平铺概览）</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;">
                                        <li><strong>发送行为：</strong><span style="color: var(--SmartThemeEmColor); font-weight: bold;">正常发送</span>。</li>
                                        <li><strong>渲染特点：</strong>在此状态下不区分是否被钉选，所有的活跃目标都会平铺为单行文本（例如 <code>[进行中] 任务A; [进行中] 任务B</code>）。格式固定，<span style="color: var(--SmartThemeEmColor);">不受“默认行模板”控制</span>。</li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">2. 全局注入开启，goals 注入开启（精细双层宏模板）</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;">
                                        <li><strong>发送行为：</strong><span style="color: var(--SmartThemeEmColor); font-weight: bold;">视注入大模板而定</span>。</li>
                                        <li><strong>核心机制：</strong>钉选后的活跃任务会<strong>自动从普通宏 <code>{{plot_goals_active}}</code> 中排除</strong>，只出现在专用宏 <code>{{plot_goals_pinned}}</code> 中。</li>
                                        <li><strong>避坑建议：</strong>默认的目标模块注入模板中不包含 <code>{{plot_goals_pinned}}</code>。如果直接钉选了某任务，它会被移出普通列表。请在“配置目标模块”->“注入”中修改注入模板，显式地将 <code>{{plot_goals_pinned}}</code> 放入其中，以发挥其持续置顶关注的高权重作用。</li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">3. 全局注入关闭，goals 注入关闭（无自动注入）</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;">
                                        <li><strong>发送行为：</strong>默认不发送。但如果用户手动在人设设定、世界书等位置引用了 <code>{{plot_goals}}</code> 或 <code>{{plot_state}}</code> 宏，则仍能解算替换。解析逻辑与“类别一”一致，全数输出行内平铺概览。</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 第四部分：RPG 模式状态流转与细分宏占位符 -->
                <div class="plot-tutorial-section" style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 6px; background: transparent; overflow: hidden; margin-top: 10px;">
                    <div class="plot-tutorial-header" style="padding: 10px 12px; background: transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background-color 0.15s;">
                        <span style="font-weight: bold; color: var(--SmartThemeEmColor); display: flex; align-items: center; gap: 8px; font-size: 0.95em;">
                            <i class="fa-solid fa-gamepad"></i> <span>4. RPG 状态含义与细分宏占位符</span>
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
#### RPG 状态定义与细分宏占位符 (RPG Statuses & Macros)

##### 1. 不同分类中任务状态 (status) 的含义
不同模块类别下，状态机流转有不同的剧情和数据逻辑：

* 任务 (quest)
    - locked (锁定): 前置任务未完成，任务隐藏或置灰不可触发。
    - unlocked (待激活): 前置完成，处于可激活但尚未正式开始的状态。
    - active (进行中): 任务正式开启，AI将向此目标对话靠拢，系统开始监听触发词。
    - complete (已完成): 任务顺利达成，级联动作执行，奖励发放。
    - failed (已失败): 任务由于某些原因（命中失败词等）宣告失败。
* 技能 (skill)
    - locked (锁定): 尚未解锁该技能的习得条件，无法点选和使用。
    - unlocked (待激活): 满足解锁要求，但玩家尚未消耗资源去“习得”。
    - complete (已习得): 玩家已学会该技能（计入技能库）。AI可演绎角色会这个能力。
    - active (已装备): 技能当前正装备在“技能栏”中。属性修正生效，AI可在战斗中直接使用。
* 物品 (item)
    - locked (锁定): 未解锁或无法获取。
    - unlocked (待激活): 配方已解锁，但玩家尚未持有。
    - complete (在背包中): 物品已获得，存放于包中。AI可演绎玩家掏出此物。
    - active (已配备): 装备穿戴在身上。属性增益开始计算，AI可演绎主角正在配备和使用它。
* 成就 (achievement)
    - locked (锁定): 未解锁的隐藏成就。
    - unlocked (待激活): 未达成的普通成就。
    - complete (已获得): 成就达成，徽章已亮起。
    - failed (已错失): 成就由于支线关闭等原因在本周目已无法达成。
* 角色 (character)
    - locked (锁定): 未登场。
    - unlocked (已认识): 已经初次相识并建档，但非伙伴。
    - active (同行中): 角色目前处于主角队伍中一起行动。AI必须描写其协同参与对话。
    - complete (羁绊契约): 角色攻略完成或个人线完美结局。

##### 2. 动态分类状态宏占位符 (Dynamic Category & Status Macros)
系统根据您任务卡片上实际填写的“分类（category）”名称，动态且全自动地为每一种状态注册对应的解算占位符。它同时支持单数与复数形式（自动加 's' 后缀）。

例如，若您当前的任务数据中存在 "quest"、"item"、"skill" 等分类，以下占位符即自动生效并在全局注入模板中可用：
- {{plot_quests_active}} / {{plot_quest_active}} : 进行中的任务
- {{plot_items_equipped}} / {{plot_item_active}} : 已装备穿戴的物品
- {{plot_items_inventory}} / {{plot_item_complete}} : 背包中的物品
- {{plot_skills_equipped}} / {{plot_skill_active}} : 已装配的技能
- {{plot_skills_learned}} / {{plot_skill_complete}} : 已习得的技能/天赋
- {{plot_characters_active}} / {{plot_character_active}} : 队伍中同行的伙伴
- {{plot_achievements_complete}} / {{plot_achievement_complete}} : 已达成的成就

※ **自定义分类无缝支持**：若您创建了自定义分类（如 "bloodline" 血统），系统会实时自动为您生成 {{plot_bloodlines_active}} 或 {{plot_bloodline_active}} 等宏。直接在全局注入模板中使用即可，完全不需要修改代码！
                        </pre>

                        <!-- 展示目标 -->
                        <div class="plot-display-content" style="display: flex; flex-direction: column; gap: 10px;">
                            <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 0.9em; border-bottom: 1px dashed var(--SmartThemeBorderColor); padding-bottom: 8px;">了解 RPG 各个类别的状态定义，并在全局注入模板中利用分门别类的细分宏，精确拼装成角色面板和背包系统：</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">1. RPG 状态在不同类别的语义说明</div>
                                    <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
                                        <li><strong>任务 (quest)：</strong><code>locked</code>(置灰锁定) ➜ <code>unlocked</code>(可接取) ➜ <code>active</code>(进行中) ➜ <code>complete</code>(已完成) / <code>failed</code>(已失败)。</li>
                                        <li><strong>技能 (skill)：</strong><code>locked</code>(未解锁) ➜ <code>unlocked</code>(可学习) ➜ <code>complete</code>(<strong>已习得/在技能库</strong>) ➜ <code>active</code>(<strong>已装备至快捷栏生效</strong>)。</li>
                                        <li><strong>物品 (item)：</strong><code>locked</code>(未知) ➜ <code>unlocked</code>(可合成/买) ➜ <code>complete</code>(<strong>在随身背包中</strong>) ➜ <code>active</code>(<strong>穿戴装备中</strong>)。</li>
                                        <li><strong>成就 (achievement)：</strong><code>locked</code>(隐藏未得) ➜ <code>unlocked</code>(可见未得) ➜ <code>complete</code>(已获得)。</li>
                                        <li><strong>角色 (character)：</strong><code>locked</code>(未见) ➜ <code>unlocked</code>(初识) ➜ <code>active</code>(<strong>同行中/已入队</strong>) ➜ <code>complete</code>(羁绊达标)。</li>
                                    </ul>
                                </div>

                                <div>
                                    <div style="font-weight: bold; color: var(--SmartThemeEmColor); font-size: 0.95em; border-left: 3px solid var(--SmartThemeEmColor); padding-left: 6px; margin-bottom: 6px;">2. 动态分类宏命名规范与自定义分类支持</div>
                                    <p style="margin: 0; opacity: 0.8;">宏的格式统一为 <code>{&#123;plot_[类别复数或单数]_[状态英文]&#125;}</code>。系统会根据您卡片里填写的实际分类（不限个数，甚至可以是自定义分类如 <code>bloodline</code>）自动注册生成并动态解析：</p>
                                    <ul style="margin: 6px 0 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; opacity: 0.85;">
                                        <li><strong>自动单/复数支持：</strong>如 <code>{&#123;plot_items_complete&#125;}</code> 或 <code>{&#123;plot_item_complete&#125;}</code> 均等价可用（系统自动兼容 <code>s</code> 尾缀）。</li>
                                        <li><strong>即加即用：</strong>您只要给任何卡片分类填入 <code>magic</code>，在全局注入大模板里写 <code>{&#123;plot_magics_active&#125;}</code>，系统当场生效，自动过滤输出对应卡片。</li>
                                    </ul>
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
                            <i class="fa-solid fa-code"></i> <span>1. 变量提取 Prompt 参考</span>
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
                            <i class="fa-solid fa-bolt"></i> <span>2. 触发器与联动动作</span>
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
