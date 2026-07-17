# Plot 剧情推动扩展 — 源码架构与文件关系梳理

本指南旨在详细梳理 **Plot — SillyTavern 剧情推动扩展** 的完整文件布局、各个文件的核心作用与所含内容，以及插件底层的核心运行机制与开发注意事项。

---

## 📂 完整目录与文件树

```
/plot
├── manifest.json              # 扩展元数据（ST 必需）
├── index.js                   # 扩展主入口（注册钩子、初始化挂载、防 DOM 销毁 MutationObserver）
├── README.md                  # 项目定位与基础说明文档
├── codebase_guide.md          # 源码架构与文件关系梳理指南（本文件）
│
├── /src
│   ├── /core                  # 核心业务逻辑层（状态管理、持久化、解析与分析引擎）
│   │   ├── store.js           # 全局在内存状态管理单例（get / set / subscribe）
│   │   ├── constants.js       # 集中常量定义（模块名、数据 Schema 版本号）
│   │   ├── serializers.js     # 状态序列化工具（转换变量、目标和故事线为 Inline 或 List 格式）
│   │   ├── indexeddb.js       # 浏览器原生 IndexedDB 包装类（高容量数据：幕后历史、活跃状态等）
│   │   ├── storage.js         # 数据加载、刷写与重置核心（ settings.json 与 IndexedDB 双规读写）
│   │   ├── migrator.js        # 数据 Schema 版本迁移机制（向后兼容，防数据结构断档）
│   │   ├── context-reader.js  # 上下文抓取器（读取人设、对话历史正则脱敏、级联装载世界书条目）
│   │   ├── prompt-builder.js  # 提示词组装核心（内置模块 Prompt 块模板定义与预设变量插槽解析）
│   │   ├── api-client.js      # AI 通信层（调用 SillyTavern 内部代理/自定义端点进行非流式/流式请求）
│   │   ├── injection.js       # 提示词注入层（GENERATE_BEFORE_COMBINE_PROMPTS 系统级自动注入）
│   │   ├── hooks.js           # SillyTavern 事件监听绑定器（捕获会话变更、角色选择、消息接收等）
│   │   ├── goal-engine.js     # [TODO Stub] 目标判定引擎
│   │   ├── storyline-engine.js# [TODO Stub] 故事线规划引擎
│   │   └── variable-engine.js # [TODO Stub] 变量/世界状态逻辑引擎
│   │
│   ├── /ui                    # 视图与控制器层（组件生命周期、事件绑定与交互控制）
│   │   ├── panel.js           # 主控制面板控制器（加载 panel.html、侧边/抽屉切换、模块 Tab 显隐控制）
│   │   ├── tab-prompts.js     # 【主Tab 5 - 提示词工作台】控制器（预设增删改、内置/自定义卡片块拖移管理）
│   │   ├── tab-logs.js        # 【主Tab 6 - 日志与测试】控制器（渲染脱敏预览、模拟组装调试、最近 API 记录）
│   │   ├── tab-settings.js    # 【主Tab 7 - 扩展设置】控制器（面板尺寸、API 管理、内容正则规则、数据导入出）
│   │   ├── tab-backstage.js   # 【主Tab 4 - 幕后】控制器（二级对话框、基于 signature 的增量渲染、Swipe 分支）
│   │   ├── tab-variables.js   # [TODO Stub] 变量界面控制器
│   │   ├── tab-goals.js       # 【主Tab 2 - 目标】控制器（递归渲染树状目标列表、状态勾选、绑定配置抽屉与级联动作）
│   │   ├── tab-storyline.js   # [TODO Stub] 故事线界面控制器
│   │   ├── module-config-drawer.js # 通用模块设置抽屉组件（管理提示词预设、API与内容读取策略，绑定到聊天会话）
│   │   └── tutorial.js        # 教程组件控制器（内置三级子 Tab 手册，支持一键复制代码段）
│   │
│   └── /utils                 # 基础工具纯函数层
│       ├── dom.js             # DOM 操作封装（级联书目折叠面板、事件委托、SillyTavern 事件联动）
│       ├── macro.js           # SillyTavern 宏系统桥接（兼容新版/旧版 API，注册 {{plot_state}} 宏）
│       └── theme.js           # 主题颜色处理（Dummy Div 读取 computedStyle，注入 HSL/RGB 格式 CSS 变量）
│
├── /styles                    # 样式控制层
│   ├── main.css               # 主界面样式（面板浮动排版、定位及 Tab 滑动转场）
│   └── components.css         # 细粒度组件样式（开关 Switch、Spinner、幕后气泡与头像框动效）
│
└── /templates                 # HTML 异步加载模板层（分离 HTML 与控制器代码）
    ├── panel.html             # 主控制面板最外层网格框架
    ├── tab-prompts.html       # 提示词卡片工作台主面板模板
    ├── tab-logs.html          # 日志与 Prompt 测试器网格布局
    ├── tab-backstage.html     # 幕后双轨对话面板、翻页器与配置抽屉布局
    ├── settings-display.html  # 设置 - 面板尺寸与激活模块全局开关
    ├── settings-connection.html# 设置 - AI API 自定义端点创建表单
    ├── settings-reading.html  # 设置 - 内容抓取深度及世界书/正则配置项
    └── settings-data.html     # 设置 - 数据导出、导入与还原区域
```

---

## 📝 详细文件作用说明

### 1. 入口与根目录文件

*   **`manifest.json`**
    *   **核心内容**：定义插件在 SillyTavern 内的展示名称（"剧情推动 (Plot)"）、加载次序（20）、加载的 JS 入口（`index.js`）、主 CSS 样式表（`styles/main.css`），以及指定激活时运行的初始化勾子（`init`）。
*   **`index.js`**
    *   **核心内容**：扩展初始化总枢纽。首先调用 `theme.js` 动态计算注入 RGB 主题色，然后执行 retry 循环往 SillyTavern 的魔棒菜单和 QR 状态栏分别挂载主入口按钮。之后，它注册全局的 MutationObserver，当 SillyTavern 因为重新渲染清除 DOM 元素时，防抖（150ms）地将 Plot 的 UI 入口按钮重新挂回页面。最后，它触发 `hooks.js` 事件总线并执行初始数据载入。

---

### 2. 核心业务逻辑层 (`/src/core/`)

*   **`store.js`**
    *   **核心内容**：内存中的状态机单例。定义了核心全局变量结构（`variables`, `goals`, `storylines`, `backstageHistory` 等），并对外提供 `get`, `set` 以及类似 Redux 的订阅模式 `subscribe(key, callback)`。此模块解耦了 UI 渲染和底层数据。当数据发生变动时，仅触发对应 key 的订阅函数，避免了高频渲染带来的卡顿。
*   **`constants.js`**
    *   **核心内容**：保存扩展在配置层读写的键名 `plot` 以及数据结构版本号。确保其他脚本在需要时能够访问一致的配置名，消除了魔术字符串的重复定义。
*   **`serializers.js`**
    *   **核心内容**：数据格式转换工具。将当前在 store 中保存的 `variables`、`goals` 以及 `storylines` 序列化。
        *   **Inline 格式**：紧凑的一行文本，供主对话提示词注入（如 `变量: 关系值: 55, 位置: 咖啡馆`）。
        *   **Block 格式**：多行 Markdown 无序列表，供 AI 判定的提示词（如 `- 关系值: 55` ）。
*   **`indexeddb.js`**
    *   **核心内容**：高容量浏览器级持久化数据库包装器。创建数据库 `PlotExtensionDB` 及存储空间 `plotData`。由于幕后的多轨分支历史和海量的状态追踪容易超出 SillyTavern 的 `settings.json` （以及单个 Character 扩展槽）的配额，这里将历史记录、大文本保存进 IndexedDB，只将控制标志位存入主配置中。
*   **`storage.js`**
    *   **核心内容**：主持久化管理器，统管读写流程。
        *   `loadPlotData()`：从 SillyTavern 的 `extension_settings` 读取全局选项，并行读取 IndexedDB 中当前角色卡/当前会话所处的活动状态，将其同步回 store，若存在历史遗留的老版本数据（如储存在 `chatMetadata` 中的 backstageHistory）则自动进行迁移和擦除。
        *   `savePlotData()`：高频触发的保存函数。利用 IndexedDB 写入当前状态及当前模式/对话分支的 backstage 记录，同时清除 `chatMetadata` 中可能产生冗余垃圾的字段。
        *   `resetAllPlotData()`：强力擦除函数。彻底清空 IndexedDB 并将 settings.json 中的相关配置重构还原为出厂默认设置。
*   **`migrator.js`**
    *   **核心内容**：版本迁移机制。管理自 `0.1.0` 起至 `0.5.0` 的链式增量迁移脚本（例如将老版的 `regexFilters` 字符数组重构为 `regexRules` 规则对象），确保旧版本用户的配置数据升级后不会发生崩溃或丢失。
*   **`context-reader.js`**
    *   **核心内容**：SillyTavern 运行上下文的深度解析读取器。
        *   读取当前角色设定文本和 User Persona 设定。
        *   通过 `SillyTavern` 核心函数，并行加载当前的角色书、全局书、聊天关联书，结合用户的自选条目白名单、正则前缀黑名单进行清洗分类，按注入深度（before_char / after_char / depth）拆分生成对应的字符串段落。
        *   截取限定条数的聊天历史，通过用户配置的正则过滤规则逐行脱敏/格式化，清除不需要的多余信息。
*   **`prompt-builder.js`**
    *   **核心内容**：提示词卡片块拼接系统。
        *   预定义了各个分析子模块（变量、目标、故事线、幕后）在 system / user 角色下的内置提示词卡片内容。
        *   提供 `resolvePlaceholders()` 函数，将模板中的占位符（如 `{{char_desc}}`, `{{chat_history}}`, `{{variables_list}}` 等）替换为通过 `context-reader.js` 读取到的脱敏上下文数据。
        *   根据用户选择的“模块预设(Preset)”，将该预设下的所有卡片块进行合并、排序，生成待发送给 AI 的完整 Messages 数组结构。
*   **`api-client.js`**
    *   **核心内容**：网络通信层。
        *   提供 `listConnections()`, `saveConnection()`, `deleteConnection()` 来管理保存在扩展配置中的自定义 API 路由（端点、密钥、最大 Token 等）。
        *   `callAI()` / `callAIStream()`：执行网络交互。若选择 “SillyTavern 默认连接”，则调用 SillyTavern 内部核心的参数生成机制以保持模型 and 全局参数对齐，发送给 SillyTavern 代理路径 `/api/backends/chat-completions/generate`；若为自定义连接，则直接调用自定义端点进行非流式/流式 SSE（Server-Sent Events）数据通信。
        *   通过 `lastApiLog` 单例保存最近一次 API 调用的全部参数与返回数据，用于在“日志与测试”面板中做可视化展示。
*   **`injection.js`**
    *   **核心内容**：主要负责在主对话 AI 请求前将当前的剧情推动状态（`plot_state` 文本块）作为系统层提示词追加注入。支持 "auto"（拦截并自动插在最后一条 system 消息后）与 "macro"（由用户手工在角色卡中通过 `{{plot_state}}` 引入，在此阶段被跳过）两种注入模式。
*   **`hooks.js`**
    *   **核心内容**：向 SillyTavern 注册生命周期监听事件。
        *   `CHAT_CHANGED` / `CHARACTER_SELECTED`：重新触发 load 流程拉取对应数据的 IndexedDB 记录。
        *   `GENERATE_BEFORE_COMBINE_PROMPTS`：触发 `injection.js` 进行 Prompt 数据切入。
        *   `MESSAGE_RECEIVED`：捕获 AI 回复。当 AI 的消息接收完毕，将文本转发给 `output-parser.js` 进行状态刷新。
*   **`goal-engine.js` / `storyline-engine.js` / `variable-engine.js`**
    *   **核心内容**：目前作为 stub 占位存在，规划在后续迭代中分别提供逻辑上的变量级联触发判定、目标子任务达成和剧情状态转移的核心判定规则逻辑。

---

### 3. UI 视图与控制器层 (`/src/ui/`)

*   **`panel.js`**
    *   **核心内容**：扩展主控制面板。从 `templates/panel.html` 载入骨架 DOM，并依次将各个一级 Tab 按钮与其对应的渲染脚本进行绑定，在切换到特定 Tab 时才进行 lazy-render（首次渲染后缓存 DOM 节点）。根据扩展的设置项应用面板大小、展示朝向样式，并通过 `refreshTabVisibility()` 在运行时动态决定特定模块 Tab 栏按钮的显示和隐藏。
*   **`tab-backstage.js`**
    *   **核心内容**：【幕后】二级对话控制面板 the logical core.
        *   管理“幕后”专属的多个独立创作模式（Mode），并在各模式下提供对话分支（Thread）的增删改流程。
        *   实现基于 DOM `data-signature` 的 **增量差量渲染算法**。当幕后历史在生成或测试中高频更新时，渲染器只重绘有修改或新增的行节点，不进行 `innerHTML = ''` 的暴力清空，以此规避 Layout Thrashing 并保存气泡的折叠/动画状态。
        *   通过事件委托统一接管气泡内的点击行为（重新生成、retry 候选、Swipe 侧滑翻页、手写修改内容和单行删除）。
        *   拥有独立的统一配置抽屉（Drawer），允许在此处微调此模式下的 API 专属连接、特定 Lorebook 抓取白名单，以及自定义主题 CSS 样式表、定制头像头像框动效。
*   **`tab-prompts.js`**
    *   **核心内容**：【提示词工作台】。负责管理六个业务模块（全局、变量、目标判定、目标生成、故事线、幕后）在不同预设（Preset）下的 Prompt 卡片列表。允许对卡片进行排序（`blk-up` / `blk-down`）、启用/禁用开关、角色更换以及打开全屏代码编辑器等操作，并挂载预设的新建、导入和导出。
*   **`tab-logs.js`**
    *   **核心内容**：【日志与测试】面板。
        *   **内容预览**：实时抓取并解算展示当前在 ST 语境下的角色设定、User Persona、过滤后的最近历史以及触发的世界书条目，便于检查占位符格式。
        *   **模拟测试与日志**：若选择对应的业务模块（拆分为目标判定与目标生成），可在后台无感调用 API client 参数解算，渲染出将要发送给 AI 模型的原始 Messages 数据结构（用于调试卡片合并情况）；若选择 real，则展示上一次在后台触发的真实 API 请求及报错/响应文本。
*   **`tab-settings.js`**
    *   **核心内容**：【扩展设置】主控台。将功能划分为二级子 Tab，包括：
        *   `display`：切换主弹窗的方向（左右抽屉/上下拉伸/常规居中）、大小和业务功能模块的显示。
        *   `api`：自定义端点添加，连接 ping 测试及模型列表拉取。
        *   `reading`：设定全局上下文读取设定。提供手动世界书自选条目树的动态生成，以及正则表达式规则过滤器的增删改查。
        *   `data`：总管数据备份导入/导出及初始化清除。
        *   `help`：嵌入 `tutorial.js` 合并版的教程说明。
*   **`tutorial.js`**
    *   **核心内容**：教程页面。基于三级子 Tab（目前主要是幕后教程）进行原生渲染。提供了宏及占位符速查、自定义主题 CSS 类名清单，并为所有的教程示例代码附加一键复制到剪贴板的组件功能。
*   **`tab-goals.js`**
    *   **核心内容**：目标界面控制器。支持树状嵌套目标的增量渲染与折叠、快捷添加、状态勾选判定，以及拉出单独的属性配置抽屉，配置目标完成时的级联动作与自动化判定规则。
*   **`module-config-drawer.js`**
    *   **核心内容**：可复用的模块级别设置抽屉组件。提供对提示词预设绑定、特定自定义 API 端点连接和内容抓取深度/世界书/正则表达式等单独读取策略的一站式配置，通过 IndexedDB 以 `cfg_` 为前缀将配置单独绑定到当前的聊天会话。
*   **`tab-variables.js` / `tab-storyline.js`**
    *   **核心内容**：UI 占位 Stub，当前提供基本的 “开发中” 说明提示，预留给后续独立状态子 Tab 开发。

---

### 4. 辅助工具与桥接层 (`/src/utils/`)

*   **`dom.js`**
    *   **核心内容**：UI 操作工具库。
        *   `setupAccordion()`：接收头元素与主体元素，挂载折叠联动动画及 Chevron 指示图标。
        *   `createElement()`：通过配置对象快速构建包含 className、内联样式 and 子树的 DOM 节点。
        *   `renderBookChecklist()`：手动选择世界书条目的组件。异步拉取特定 Lorebook 后在页面上展示条目清单复选框，若未开启“自选条目”，则折叠隐藏，若开启则动态同步修改 manuallySelectedEntries。
        *   `subscribeWIRefresh()`：侦听 SillyTavern 的一系列世界观更新、编辑事件，并执行 250ms 的防抖更新回调，确保在 ST 中修改世界书时 Plot 能够刷新选择树。
*   **`macro.js`**
    *   **核心内容**：宏注册机制。注册 `{{plot_state}}`, `{{plot_variables}}`, `{{plot_goals}}`, `{{plot_storyline}}` 宏。提供四套级联兼容方案（现代 `macros.register` API ➔ 遗留 `MacrosParser` ➔ 上下文 `registerMacro` ➔ 直接 Monkey Patch 重写 `ctx.substituteParams`），规避了在不同 SillyTavern 版本下宏注册抛出未定义异常的问题。
*   **`theme.js`**
    *   **核心内容**：ST 皮肤变量的色彩转换适配器。由于部分版本的 SillyTavern 没有导出透明色所需的 `-rgb` 格式色彩变量（如 `--SmartThemeBlurTintColor-rgb`），此脚本在运行时创建一个临时的隐藏 `div`，以目标主题色变量作为文字颜色写入 document，通过 `window.getComputedStyle().color` 抓取浏览器解算出的 RGB 真实色彩分量，并重新将 `-rgb` 后缀的变量挂载回 documentElement，确保毛玻璃及半透明毛玻璃特效工作正常。

---

### 5. 样式层 (`/styles/` 与 `/templates/`)

*   **`styles/main.css`**
    *   **核心内容**：核心面板外观表现样式。定义了 Overlay 遮罩层，不同位置状态下的抽屉划入/弹窗伸缩 transition 动画，Tab 标签滑块等布局控制。
*   **`styles/components.css`**
    *   **核心内容**：细小组件的物理外观规范。包含 Accordion 折叠面板样式，自定义 Switch 开关动效，Loading Spinner 旋转特效，以及【幕后】专属消息气泡的对齐（user靠右、bot靠左）、打字机等待跳动点、悬浮工具栏和头像发光边框等精美动效。
*   **`/templates/*.html`**
    *   **核心内容**：SillyTavern 官方推荐的异步模板文件。为避免在 JS 中使用大段 backticks 拼接 HTML，所有 UI 文件的骨架都在此目录下定义，并在 UI 控制器中使用 `renderExtensionTemplateAsync('third-party/plot', 'templates/...')` 加载并交由控制器进行事件绑定与数据同步。

---

## 🔄 核心运转机制与生命周期流程

### A. 启动与数据挂载流程
1.  **SillyTavern** 在启动阶段，通过 `manifest.json` 加载并解析扩展，执行 `index.js` 的 `init()`。
2.  `init()` 执行时，`theme.js` 抓取主题 computedStyle，在 root 上补全 `-rgb` 色彩以适配磨砂及透明特效。
3.  通过 `storage.js` 的 `loadPlotData()`，插件向 IndexedDB 发出异步查询，加载最近一次对话绑定的变量、目标、故事线及幕后对话历史，同步进 `store.js` 内存。
4.  检查角色卡扩展槽中是否有通过 Character V2 导出的模版，如果没有活跃数据，则使用模版填充。
5.  往页面魔棒菜单（Magic Wand Menu）和状态栏（QR Bar）注入 Plot 一级控制弹窗的入口按钮，并绑定 MutationObserver 在 DOM 重绘时动态补挂载。

### B. 对话消息接收与自动判定流程 (Path C)
1.  用户与 AI 进行主线对话，AI 输出内容。
2.  SillyTavern 派发 `MESSAGE_RECEIVED` 钩子，SillyTavern.getContext() 返回消息体。
3.  `hooks.js` 拦截非 user 类型的 AI 文本，交由 `output-parser.js` 的 `parseMessage()` 处理。
4.  `output-parser.js` 依次触发三道流水线：
    *   **JSON 提取器**：查找 ```json ... ``` 块。如存在，将其解构并合并更新 `variables` 和 `goals` 的状态。
    *   **关键词映射器**：检索用户在设置页配置的文本标记（如 "好感+5"），如果有命中，则对关联的 store 变量执行四则运算、布尔取反，并自动限幅（clamp to min/max）。
    *   **正则匹配提取器**：利用正则表达式和捕获组，直接从大模型文本中提取动态变量名称和数值更新。
5.  若发生改变，调用 `storage.js` 刷写 IndexedDB 持久化存档，并派发自定义 DOM 事件 `plot:storeUpdated` 刷新 Tab 红点徽章状态。

### C. 提示词合并与注入流程 (Path A/B)
1.  当用户按下发送按钮，SillyTavern 在拼装发送至大模型的 Prompt 前派发 `GENERATE_BEFORE_COMBINE_PROMPTS` 钩子。
2.  `hooks.js` 监听到此事件，调用 `injection.js` 的 `injectIntoPrompt()`。
3.  如果用户处于 "auto" 注入模式，`injection.js` 调用序列化函数，将当前激活模块的变量、目标、故事线拼接成一段如下结构：
    ```text
    [剧情状态]
    变量状态: 关系值: 55, 位置: 咖啡馆
    当前目标: [进行中] 获得信任
    故事线: 主线 | 章节: 第二章
    [/剧情状态]
    ```
4.  将该文本作为一个全新的 `system` 角色消息拼入 `chatContext.chat` 的 system 消息队列尾部。
5.  如果用户选择的是 "macro" 注入模式，则本阶段直接跳过。`macro.js` 中注册的 `{{plot_state}}` 宏会被 SillyTavern 自身的宏处理引擎调用，由插件动态替换为主对话中角色卡或系统提示词里指定的对应占位位置。

### D. 幕后交互与生成流程 (Backstage Channel)
1.  用户在“幕后”控制台发送引导指令，`tab-backstage.js` 拦截表单并将用户气泡以 `user` 角色推入对话流。
2.  调用 `context-reader.js` 构造当前大模型的上下文信息包（抓取净化后的主对话历史、引用的 Lorebook 自选信息、全局总结文本以及当前的变量/故事线列表）。
3.  `prompt-builder.js` 根据当前模式选择的幕后预设，将 prompt 卡片块逐一用 context 包的数据替换占位符。
4.  `api-client.js` 执行网络发起。如果是自定义连接，则使用 `fetch` 绕过主模型的代理，直连用户设定的 API 端点，解析流式 SSE。
5.  在模型生成过程中，气泡利用 signature 比对进行差量 DOM 重绘，并逐字显示出 AI 幕后策划回复。消息最终归档写入 IndexedDB 对应的 mode ➔ thread 分支中。

---

## 🛠️ 通用工具库与辅助库说明

在本扩展中，有若干文件起到了**通用工具库/辅助类库**的作用。它们不包含特定的业务流状态，而是通过暴露纯函数或高度封装的桥接方法，来支撑整个扩展在 SillyTavern 生态中的稳定运行。以下为主要的工具/辅助库文件：

### 1. [utils/dom.js](file:///d:/SillyTavern/public/scripts/extensions/third-party/plot/src/utils/dom.js) (DOM 动作与选择组件封装库)
*   **定位**：UI 交互底层工具库。
*   **主要功能**：
    *   `setupAccordion`：一键绑定折叠面板的过渡、展开状态及 Chevron 旋转指示。
    *   `createElement`：通过 JSON 属性、样式描述快速创建含有复杂层级子树的 HTMLElement 实例。
    *   `renderBookChecklist`：高级表单组件，用于在 UI（设置和幕后抽屉）中级联载入 SillyTavern 的 Lorebook 条目复选列表，处理用户对每个世界书条目的**细粒度自选白名单机制**。
    *   `subscribeWIRefresh`：事件总线桥接工具，用于对 SillyTavern 发生的世界书更新、角色卡重载等事件进行防抖（250ms）监听，保持扩展内自选列表与全局数据的状态实时对齐。

### 2. [utils/theme.js](file:///d:/SillyTavern/public/scripts/extensions/third-party/plot/src/utils/theme.js) (SillyTavern 主题适配与 RGB 解算工具)
*   **定位**：视觉与样式底座辅助库。
*   **主要功能**：
    *   `getThemeRgb`：通过创建临时 DOM 计算出当前网页的 `window.getComputedStyle().color` 的实际 rgba 值，进而提取出红绿蓝三色数值通道。
    *   `injectThemeRgbVariables`：计算并将 `--SmartThemeBlurTintColor-rgb` 等变量挂载回 HTML `documentElement`（网页 `:root`），使得 UI 中的 `styles/components.css` 可以通过原生 CSS 的 `rgba(var(--xxx-rgb), 透明度)` 形式安全且美观地设定半透明磨砂毛玻璃背景，完美适配不同主题。

### 3. [utils/macro.js](file:///d:/SillyTavern/public/scripts/extensions/third-party/plot/src/utils/macro.js) (SillyTavern 宏系统多版本兼容桥接库)
*   **定位**：SillyTavern 扩展性桥接库。
*   **主要功能**：
    *   `registerMacros`：注册 `{{plot_state}}`, `{{plot_variables}}`, `{{plot_goals}}`, `{{plot_storyline}}` 宏。
    *   **兼容设计**：由于用户使用的 SillyTavern 版本可能跨越极长的时间线，本库通过四层退化 fallback 机制确保注册成功而不抛出报错（依次尝试：现代新版 `macros.register` ➔ 遗留 `MacrosParser.registerMacro` ➔ 上下文 `ctx.registerMacro` ➔ 暴力拦截重写 `ctx.substituteParams`）。

### 4. [core/serializers.js](file:///d:/SillyTavern/public/scripts/extensions/third-party/plot/src/core/serializers.js) (状态数据序列化辅助库)
*   **定位**：数据结构格式化工具。
*   **主要功能**：
    *   提供统一的变量、目标、故事线数据的转换逻辑。
    *   输出的 **Inline 紧凑文本** 供主线注入与宏读取（如 `关系: 50`）；输出的 **Block 列表 Markdown** 供 AI 分析引擎作为判定提示词，避免了数据展现格式在 `prompt-builder.js` 和 `injection.js` 间的重复硬编码。

### 5. [core/indexeddb.js](file:///d:/SillyTavern/public/scripts/extensions/third-party/plot/src/core/indexeddb.js) (浏览器 Native 存储包装库)
*   **定位**：本地数据存储层工具。
*   **主要功能**：
    *   提供异步 Promise 风格 of `getPlotValue`, `savePlotValue`, `deletePlotValue` 和数据库一键清除 `clearAllPlotDB` 接口。
    *   屏蔽了浏览器原生 `indexedDB` 事务（transaction）与对象库（objectStore）复杂的流程调用，使其易于被 `storage.js` 引入。

### 6. [ui/module-config-drawer.js](file:///d:/SillyTavern/public/scripts/extensions/third-party/plot/src/ui/module-config-drawer.js) (模块化对话设置组件)
*   **定位**：复用配置组件辅助库。
*   **主要功能**：
    *   `createModuleConfigDrawer`：动态构建并在特定 Tab 容器中挂载独立的 Sliders 选项抽屉。
    *   内置完整的独立 API 下拉框、提示词预设选择器、以及 Lorebooks / Regex 正则裁剪等高级策略的深度表单绑定，帮助 Goals (以及后续 Variables/Storyline) 模块实现对话级的专属设置隔离。
    *   针对目标（Goals）子模块，提供特定的**显示字段自定义配置（自选标题/描述/状态/徽章）**和 **AI 目标生成提示词系统引导自定义配置**，全方位支撑任务树的个性化展示与 AI 高度可定制生成。

---

## ⚠️ 开发者黄金守则

1.  **绝对路径与引入深度规范**：
    所有位于 `/src/ui/` 和 `/src/core/` 目录下的 JavaScript 文件，由于其物理位置比 SillyTavern 的核心主脚本根目录（`/public/scripts/`）深了 5 层。因此在引入 `extensions.js`、`world-info.js` 或 `openai.js` 等 ST 原生公用函数时，**必须且只能**使用正好 5 个父层级前缀：
    `import { getContext } from '../../../../../extensions.js';`
    写错为 4 个层级将导致浏览器报 MIME 错误，使插件在启动时被 ST 静默废弃。
2.  **SillyTavern 事件名称大小写**：
    SillyTavern 的上下文对象中，事件总线的名称是驼峰命名的 `eventTypes`，不是下划线的 `event_types`。注册钩子时请格外注意防范 Undefined 报错。
3.  **禁止硬编码颜色值**：
    主样式和组件样式中，绝对不能出现如 `#ffffff`、`#1a1a2e`、`red` 等硬编码颜色。背景色、边框色、文字色一律调用 ST 主题提供的 CSS 变量（如 `var(--SmartThemeBodyColor)`）。半透明遮罩等效果须借助 `theme.js` 计算生成的 `-rgb` 变量并使用 `rgba(var(--SmartThemeBlurTintColor-rgb), 0.5)` 定义。
4.  **禁止膨胀 settings.json 与 chatMetadata**：
    `settings.json`（全局配置）和 `chatMetadata`（单个对话存档）有严格的大小及读写频率限制。任何可能持续增长的数据（如多轮幕后历史对话、高频的变量快照）**严禁**直接存入其中，必须使用 `indexeddb.js` 将其路由至浏览器 Native 的 `PlotExtensionDB` 中。
5.  **严格的 DOM 增量 Diff 渲染**：
    渲染例如幕后历史气泡等大型长列表时，绝不允许粗暴地使用 `container.innerHTML = ''`。必须在 DOM 节点上设计 signature 比对签名，在刷新时仅追加渲染新增的气泡或重绘发生修改的行，避免严重的闪烁与渲染开销。
6.  **HTML 结构组件化与模板化**：
    JS 控制器内严禁编写长篇大论的 HTML 模板文本。必须将所有的界面结构放置于 `/templates` 目录下并在控制器中异步获取，以确保功能与表现层解耦。
