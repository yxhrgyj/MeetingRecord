# 会议记录助手 — 设计方案

> 版本：1.0.0 | 最后更新：2026-05-21

---

## 一、项目概述

### 1.1 项目定位

面向个人用户的本机会议纪要管理工具。核心理念是「日历联动 + 自由书写」—— 在日历上看到哪天有会，点击进入全屏编辑器自由书写纪要，无需填写繁琐的结构化字段。

### 1.2 核心特点

- **纯本地存储**：所有数据以 JSON 文件形式存在本地磁盘，无云端依赖，数据完全由用户掌控
- **日历联动**：月/周/日三种视图展示会议分布，点击日期或会议卡片直接进入记录
- **自由书写编辑器**：不强制结构化字段，Markdown 风格的纯文本编辑，工具栏辅助格式插入
- **自动保存**：每分钟自动保存草稿，防止意外丢失
- **一键导出**：单篇或整月导出为 Markdown 文件

### 1.3 使用场景

1. 开会前在日历上创建会议记录条目（标题、时间、参会人）
2. 会议中全屏编辑器自由记录要点
3. 会后导出 Markdown 纪要归档或分享
4. 按周/月回顾会议历史

---

## 二、技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────┐
│         浏览器 (localhost:3001)          │
│  ┌───────────────────────────────────┐  │
│  │   Vue 3 前端 (Vite 构建)           │  │
│  │   — 日历三视图 (月/周/日)           │  │
│  │   — 全屏编辑器                      │  │
│  │   — 全屏详情页                      │  │
│  └──────────────┬────────────────────┘  │
│                 │ REST API (fetch)       │
│  ┌──────────────▼────────────────────┐  │
│  │   Express.js 后端 (Node.js)        │  │
│  │   — 数据读写 (JSON 文件)            │  │
│  │   — Markdown 导出                  │  │
│  │   — 静态文件托管 (dist/)            │  │
│  └──────────────┬────────────────────┘  │
│                 │ fs 读写                │
│  ┌──────────────▼────────────────────┐  │
│  │   本地存储 (data/YYYY-MM.json)      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 2.2 技术选型

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| 前端框架 | Vue 3 (Composition API) | ^3.x | 组件化开发，`<script setup>` 简洁高效 |
| 构建工具 | Vite | ^5.0 | 开发热更新快，打包体积小 |
| CSS 方案 | Tailwind CSS + 自定义组件类 | ^3.4 | 原子化 CSS 快速构建，自定义类保证一致性 |
| 后端 | Express.js | ^4.18 | 轻量 HTTP 服务，托管静态文件 + REST API |
| ID 生成 | uuid | ^9.0 | 生成会议唯一标识 |
| 数据存储 | 本地 JSON 文件 | — | 无外部依赖，数据结构透明可编辑 |

### 2.3 开发与生产模式

- **开发模式**：`npm run dev` → Vite 开发服务器 (port 5173)，API 请求通过 Vite proxy 转发到 Express (port 3001)
- **生产模式**：`npm run build` → 前端打包为 `dist/`，Express 直接托管静态文件，`start.bat` 一键启动
- **启动流程**：`start.bat` → 打开浏览器 `http://localhost:3001` → 启动 `node server.js`
- **隐藏窗口启动**：`start.vbs` → 以最小化方式运行 `start.bat`，无终端窗口

> 生产模式下，所有非 `/api` 请求均返回 `dist/index.html`，由 Vue Router（如果需要）或单一入口处理。

---

## 三、数据结构

### 3.1 会议对象 (Meeting)

```typescript
interface Meeting {
  id: string              // UUID v4，唯一标识
  title: string           // 会议标题（必填）
  date: string            // 日期，格式 YYYY-MM-DD（必填）
  startTime: string       // 开始时间，格式 HH:MM
  endTime: string         // 结束时间，格式 HH:MM
  attendees: string[]     // 参会人姓名列表
  content: string         // 自由书写的会议纪要内容（纯文本，Markdown 风格）
  createdAt: string       // 创建时间，ISO 8601
  updatedAt: string       // 最后更新时间，ISO 8601
}
```

### 3.2 存储方案

- **文件路径**：`data/YYYY-MM.json`（按月分文件）
- **文件格式**：JSON 数组，每个元素为一个 Meeting 对象
- **示例** `data/2026-05.json`：

```json
[
  {
    "id": "a1b2c3d4-...",
    "title": "产品需求评审",
    "date": "2026-05-21",
    "startTime": "14:00",
    "endTime": "15:30",
    "attendees": ["张三", "李四"],
    "content": "## 会议议题\n\n1. 功能A评审\n\n## 待办事项\n\n- [ ] 张三: 补充需求文档",
    "createdAt": "2026-05-21T06:00:00.000Z",
    "updatedAt": "2026-05-21T08:30:00.000Z"
  }
]
```

### 3.3 设计考量

- **按月分文件**：避免单个文件过大，加载时只需读取当前月份的文件
- **极简数据模型**：不引入「议程项」「决议」「待办」等子结构，一律放在 `content` 自由文本中
- **日期前端格式**：`date` 字段存 `YYYY-MM-DD` 字符串，与 HTML `<input type="date">` 原生格式一致
- **跨月查询**：获取单个会议 / 删除会议时遍历所有月份文件，复杂度 O(月份数)，对个人使用完全够用

---

## 四、API 设计

Base URL: `/api`

### 4.1 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/meetings?month=YYYY-MM` | 获取指定月份所有会议 |
| GET | `/meetings/:id` | 获取单个会议（跨文件搜索） |
| POST | `/meetings` | 创建新会议 |
| PUT | `/meetings/:id` | 更新会议 |
| DELETE | `/meetings/:id` | 删除会议 |
| GET | `/meetings/:id/export` | 导出单个会议为 Markdown |
| GET | `/meetings/export/month?month=YYYY-MM` | 导出整月会议为 Markdown |

### 4.2 接口详情

#### POST /api/meetings

请求体：
```json
{
  "date": "2026-05-21",
  "title": "产品需求评审",
  "startTime": "14:00",
  "endTime": "15:30",
  "attendees": ["张三", "李四"],
  "content": "## 会议议题\n..."
}
```
响应：201 Created，返回完整 Meeting 对象（含 id, createdAt, updatedAt）

校验：`date` 和 `title` 为必填，缺失返回 400。

#### PUT /api/meetings/:id

请求体：同 POST，字段均可选，仅更新传入的字段。`id` 和 `createdAt` 不可覆盖，`updatedAt` 自动更新为当前时间。

注意：更新会议时按 `date` 字段确定存储月份文件。如果修改了日期（跨月），旧月份文件中的记录不会被自动清理——这是已知限制，个人使用时手动清理即可。

#### DELETE /api/meetings/:id

遍历所有月份文件查找并删除，返回 `{ success: true }`。未找到返回 404。

#### GET /api/meetings/:id/export

返回 Markdown 格式文件，Content-Disposition 触发浏览器下载。

导出格式：
```markdown
# 会议标题

- **日期**: 2026-05-21
- **时间**: 14:00 - 15:30
- **参会人**: 张三、李四

---

[会议正文内容，原样输出]
```

#### GET /api/meetings/export/month?month=YYYY-MM

按日期+时间排序后拼接多篇纪要，顶部添加月报标题和会议统计。

### 4.3 错误处理

所有错误返回 JSON 格式：`{ message: "错误描述" }`，前端 `useApi.js` 统一处理 HTTP 异常并 throw Error。

---

## 五、前端架构

### 5.1 组件树

```
App.vue
├── CalendarView.vue          ← 日历容器（视图分发）
│   ├── MonthView.vue         ← 月视图（6×7 网格）
│   ├── WeekView.vue          ← 周视图（时间线 + 7列）
│   └── DayView.vue           ← 日视图（单列时间线）
├── MeetingEditor.vue          ← 全屏编辑器（Overlay）
└── MeetingDetail.vue          ← 全屏详情页（Overlay）
```

### 5.2 页面状态管理

App.vue 通过 `pageMode` 控制三种页面状态：

```
pageMode = null         → 显示日历主界面
pageMode = 'editor'     → 显示全屏编辑器 (MeetingEditor)
pageMode = 'detail'     → 显示全屏详情 (MeetingDetail)
```

两种 Overlay 页面使用 Vue `<Transition name="page">` 实现缩放淡入动画。

### 5.3 数据流

```
App.vue (meetings ref)
  │
  ├── loadMeetings()  →  API.fetchMeetings(year, month)
  │     └── 更新 meetings.value
  │
  ├── CalendarView
  │     └── computed: meetingsByDate  (按 date 分组)
  │           ├── MonthView: 按日期过滤展示
  │           ├── WeekView:  按日期过滤 + 时间定位
  │           └── DayView:   按日期过滤 + 时间定位
  │
  ├── MeetingEditor
  │     ├── props.initialData  →  初始化表单
  │     ├── emit('save')       →  App.handleSave()  →  API CRUD
  │     └── 内部自动保存       →  API (独立调用，不通过 App)
  │
  └── MeetingDetail
        ├── props.meeting       →  展示
        └── emit('edit'/'delete'/'export')  →  App 处理
```

### 5.4 Composable 设计

#### useApi.js

封装所有后端请求，提供方法：
- `fetchMeetings(year, month)`
- `getMeeting(id)`
- `createMeeting(data)`
- `updateMeeting(id, data)`
- `deleteMeeting(id)`
- `exportMeeting(id)` — 返回 Blob
- `exportMonth(year, month)` — 返回 Blob

所有方法共享统一的错误处理逻辑（`request()` 基函数）。

#### useDateUtils.js

纯日期计算工具，无副作用：
- `today()`, `formatDate()`, `formatDisplay()`, `formatMonth()`
- `isSameDay()`, `isToday()`
- `getMonthGrid(year, month)` — 返回 6×7 日历网格（含上月/下月填充）
- `getWeekDays(date)` — 返回该周 7 天（周一起）
- `addMonths()`, `addWeeks()`, `addDays()`
- `startOfWeek()`, `parseDateStr()`
- `WEEKDAY_NAMES` — `['一','二','三','四','五','六','日']`

---

## 六、核心组件设计

### 6.1 App.vue — 应用主控

**职责**：全局状态管理、日历/编辑器/详情页切换、数据加载

**关键状态**：
- `currentView`: `'month' | 'week' | 'day'`
- `currentDate`: 当前浏览日期（用于导航偏移）
- `meetings`: 当前月份会议列表
- `pageMode`: `null | 'editor' | 'detail'`

**导航逻辑**：
- 月视图：`addMonths(dir)`，左右按钮切换月份
- 周视图：`addWeeks(dir)`，左右按钮切换周
- 日视图：`addDays(dir)`，左右按钮切换日
- 「今天」按钮：重置为当天 + 月视图

**数据加载**：watch `currentDate` + `currentView` 变化，在月视图下自动拉取对应月份数据。周/日视图沿用已加载的月数据。

### 6.2 CalendarView.vue — 视图分发器

根据 `props.view` 渲染对应的 MonthView / WeekView / DayView。核心工作是计算 `meetingsByDate`（按日期分组的 Map），统一通过 props 下发给子视图。

### 6.3 MonthView.vue — 月视图

**布局**：CSS Grid，7 列（周一至周日），最多 6 行，42 格

**关键逻辑**：
- `getMonthGrid()` 返回 6×7 网格，含上月末尾和下月开头的补齐日期
- 每个格子展示当天会议卡片（时间 + 标题）
- 悬浮时显示 "+" 按钮，点击进入新建记录（自动带入日期）
- 今天高亮（indigo 背景圆）和非本月日期（opacity 降低）

### 6.4 WeekView.vue — 周视图

**布局**：CSS Grid，`grid-template-columns: 56px repeat(7, 1fr)`，表头和内容区共用同一套列宽

**时间轴**：单容器 `height: 1440px`（24 小时 × 60px），所有元素绝对定位

**定位算法**：

```
topPx(meeting)  = startHour × 60 + startMinute    // 距顶部像素
heightPx(meeting) = (endHour × 60 + endMinute) - (startHour × 60 + startMinute)
                    → 至少 30px 保证可点击
```

- 时间标签列（56px）：每 60px 一个 `HH:00` 文字
- 日列（相对定位容器内）：时间槽 div（60px 高，可点击创建会议）+ 会议卡片 div
- 会议卡片 `z-index: 10` 浮于时间槽上方

### 6.5 DayView.vue — 日视图

与 WeekView 相同的像素定位方案，但只有单列时间线。

**独有特性**：
- 日期头部显示日期数字、星期、会议数
- 会议卡片更大（p-3），显示参会人头像缩写（最多 3 个）
- 卡片宽度 `left-16 right-2`（左侧留白给时间标签）

### 6.6 MeetingEditor.vue — 编辑器

编辑器是本项目的核心组件，详情见第七章。

### 6.7 MeetingDetail.vue — 详情页

**展示策略**：与编辑器保持一致的样式 —— 等宽字体（`font-mono`）、保留原始格式（`whitespace-pre-wrap`），使用 `<pre>` 标签而非 HTML 渲染。

**操作按钮**：编辑（进入编辑器）、导出（下载 .md）、删除（确认后删除并返回日历）。

---

## 七、编辑器设计（MeetingEditor.vue）

### 7.1 布局结构

```
┌─────────────────────────────────────┐
│ [←返回] [标题输入框]      [保存按钮] │  ← 顶部栏
├─────────────────────────────────────┤
│ [日期] [开始时间-结束时间] [开始][结束] [参会人] │  ← 元信息栏
├─────────────────────────────────────┤
│ H2 H3 | B I | 1. - ☐ ❝ </> — | 📋模板│  ← 工具栏
├─────────────────────────────────────┤
│                                     │
│        自由书写区域 (textarea)        │  ← 等宽字体、全屏高度
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### 7.2 编辑器表单字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | text input | 是 | 会议标题，保存时校验非空 |
| date | `<input type="date">` | 是 | 日期，新建时自动填入当前日期 |
| startTime | `<input type="time">` + 快捷按钮 | 否 | 开始时间，可手动输入或点击「开始」按钮自动填入当前时间 |
| endTime | `<input type="time">` + 快捷按钮 | 否 | 结束时间，可手动输入或点击「结束」按钮自动填入当前时间 |
| attendees | 标签输入 | 否 | 输入姓名后回车或逗号添加标签 |
| content | textarea | 否 | 自由书写内容 |

### 7.3 参会人标签输入

输入框绑定 `attendeeInput`，监听 `keydown` 事件：
- 按下 `Enter` 或 `,`（中文逗号也算分隔）→ 添加标签
- 失焦时自动将输入内容添加为标签
- 标签显示为圆角白色徽章，点击 × 移除

### 7.4 快捷记录时间

时间输入框旁边有两个小按钮：

| 按钮 | 功能 |
|------|------|
| 开始 | 将当前系统时间（HH:MM）自动填入"开始时间" |
| 结束 | 将当前系统时间（HH:MM）自动填入"结束时间" |

实现函数 `recordStartTime()` / `recordEndTime()`：读取 `new Date()` 的时分，用 `padStart(2, '0')` 补零格式化。

使用场景：会议开始时点击「开始」，结束时点击「结束」，无需手动看表输入。

### 7.5 工具栏功能

工具栏提供快捷格式插入，本质是通过 `insertAtCursor()` 在光标处插入 Markdown 标记：

| 按钮 | 功能 | 插入内容 |
|------|------|----------|
| H2 | 二级标题 | `\n## ` |
| H3 | 三级标题 | `\n### ` |
| B | 加粗 | `**选中文字**` |
| I | 斜体 | `*选中文字*` |
| 1. | 有序列表 | `\n1. ` |
| - | 无序列表 | `\n- ` |
| ☐ | 待办勾选框 | `\n- [ ] ` |
| ❝ | 引用 | `\n> ` |
| </> | 代码块 | `\n\`\`\`\n选中\n\`\`\`\n` |
| — | 分隔线 | `\n---\n` |
| 📋 模板 | 会议模板 | 见下方模板内容 |

**insertAtCursor(before, after)** 核心逻辑：
1. 获取 textarea 的 `selectionStart` / `selectionEnd`
2. 如果有选中文本，用 `before + 选中文本 + after` 包裹
3. 插入后将光标移到插入内容之后

### 7.6 自动续号系统（核心算法）

编辑器的核心交互：用户在编号列表、项目符号或待办列表中按 Enter 时，自动续接下一个标记。

#### 7.6.1 主入口：handleEnterKey(e)

每次按下 Enter（非 Shift+Enter 时）触发，顺序匹配以下模式：

```
当前行匹配：
  "N. 内容"  →  续编号（创建 "N+1. "，后续编号全部 +1）
  "N. "      →  取消编号（删除空标记行）
  "- [ ] 内容" → 续待办（新建 "- [ ] "）
  "- [ ] "   →  取消待办（删除空标记行）
  "- 内容"   →  续列表（新建 "- "）
  "- "       →  取消列表（删除空标记行）
  (无匹配)   →  回退到 findListAncestor() 查找祖先列表上下文
```

#### 7.6.2 续编号逻辑 (numMatch)

假设光标在 "1. 内容" 行尾按 Enter：

```
操作：在 "1. 内容\n" 之后插入 "\n2. "
结果：
  1. 内容
  2.                  ← 光标停在这里

后续行处理（renumberAfter）：
  原：2. 事项B         →  3. 事项B
  原：3. 事项C         →  4. 事项C
```

**renumberAfter(text, startNum)** 详细逻辑：

```
输入：text = "2. 事项B\n3. 事项C\n\n其他文字"
     startNum = 3

处理流程：
  split('\n') → ["2. 事项B", "3. 事项C", "", "其他文字"]
  
  i=0: "2. 事项B" → 非空，started=true，匹配 /^\d+\.\s/ → "3. 事项B"，counter=4
  i=1: "3. 事项C" → 匹配 /^\d+\.\s/ → "4. 事项C"，counter=5
  i=2: "" → 空行，break（列表块结束）
  
  返回："3. 事项B\n4. 事项C\n\n其他文字"
```

**为什么要用 startNum 而非 parseInt(n)+1？**

旧方案对每行独立计算 `parseInt(n) + 1`，当用户删除插入行后再次回车插入时，后续行已经是重编号过的（如 "4. C"），再次 +1 变成 "5. C"，造成编号累加错误。

新方案无论调用多少次，`renumberAfter("4. C", 5)` 始终返回 `"5. C"`——结果是确定性的。

#### 7.6.3 空标记消除 (emptyNumMatch / emptyChkMatch / emptyBulMatch)

当用户在空标记行（如 "2. " 后面没有内容）按 Enter 时，视为"取消列表"，删除该空行并退回到普通文本模式。

#### 7.6.4 列表祖先查找 (findListAncestor)

当当前行不是列表标记（例如 Shift+Enter 软换行后的文本行），但用户仍在列表内部时，通过向上扫描找到最近的列表祖先：

```
示例：
  1. 第一项
     续行文字              ← 这是 Shift+Enter 软换行
     [光标在这里按 Enter]   ← 当前行不匹配列表标记

向上扫描：
  "续行文字" → 不是编号
  "1. 第一项" → 是编号，返回 { type: 'number', next: 2 }
  
结果：续编号为 "2. "
```

停止条件：遇到空行（说明已离开当前列表块）。

### 7.7 Shift+Enter 软换行

在列表项内需要换行但不创建新标记时，使用 Shift+Enter。

**缩进计算**：
1. 优先沿用当前行的前导空格（如果用户手动缩进了）
2. 否则按列表标记的宽度计算缩进：
   - 编号 `"1. "` → 缩进 3 个空格
   - 待办 `"- [ ] "` → 缩进 6 个空格
   - 无序 `"- "` → 缩进 2 个空格

这样软换行后的续行文字与上一行文字对齐，而非从行首开始。

### 7.8 快捷键

| 快捷键 | 功能 |
|--------|------|
| Enter | 自动续号 / 普通回车 |
| Shift+Enter | 软换行（保持缩进对齐） |
| Ctrl+S / Cmd+S | 手动保存并返回 |
| Tab | 插入 2 个空格（缩进） |

### 7.9 自动保存机制

- **触发**：编辑器挂载时启动 `setInterval(fn, 60000)`
- **条件**：标题或内容至少一项非空时才保存（避免空记录）
- **行为**：
  - 已有 `id` → 调用 `api.updateMeeting()`
  - 无 `id`（新建中）→ 先 `api.createMeeting()` 获取 id，后续自动保存走更新
- **状态提示**：
  - `"保存中…"` — 正在请求
  - `"已自动保存 HH:MM"` — 保存成功（3 秒后消失）
  - `"自动保存失败"` — 请求异常（3 秒后恢复为之前的状态文字）
- **卸载**：`onUnmounted` 时 `clearInterval` 清理定时器

---

## 八、样式系统

### 8.1 Tailwind 配置

**颜色主题**：自定义 `primary` 色板（indigo 系列），覆盖 50-900 共 10 级

**字体**：系统默认中文字体栈（PingFang SC, Microsoft YaHei 等）

### 8.2 自定义组件类

在 `style.css` 中定义了 5 个组件类，保证 UI 一致性：

| 类名 | 用途 |
|------|------|
| `.btn-primary` | 主操作按钮（indigo 背景、白色文字） |
| `.btn-secondary` | 次要按钮（白色背景、灰色边框） |
| `.btn-ghost` | 幽灵按钮（无边框、悬浮变色） |
| `.card` | 卡片容器（白色、圆角、阴影） |
| `.input-field` | 标准输入框 |
| `.label-text` | 表单标签 |

### 8.3 滚动条

全局覆盖 WebKit 滚动条样式：6px 宽、圆角、灰色滑块。

---

## 九、目录结构

```
meeting-assistant/
├── index.html                 ← SPA 入口 HTML
├── package.json               ← 依赖与脚本
├── vite.config.js             ← Vite 配置（代理、别名）
├── tailwind.config.js         ← Tailwind 主题配置
├── postcss.config.js          ← PostCSS 插件
├── start.bat                  ← 一键启动脚本（生产模式）
├── start.vbs                  ← 隐藏终端窗口的 VBS 启动器
├── server.js                  ← Express 后端（API + 静态文件）
├── data/                      ← 数据存储目录
│   └── YYYY-MM.json           ← 按月存储的会议数据
├── dist/                      ← 前端构建产物（npm run build 生成）
├── DESIGN.md                  ← 本设计文档
└── src/
    ├── main.js                ← Vue 应用入口
    ├── style.css              ← 全局样式 + 组件类
    ├── App.vue                ← 应用主控组件
    ├── composables/
    │   ├── useApi.js          ← API 请求封装
    │   └── useDateUtils.js    ← 日期计算工具
    └── components/
        ├── CalendarView.vue   ← 日历容器（视图分发）
        ├── MonthView.vue      ← 月视图
        ├── WeekView.vue       ← 周视图
        ├── DayView.vue        ← 日视图
        ├── MeetingEditor.vue  ← 全屏编辑器
        └── MeetingDetail.vue  ← 全屏详情页
```

---

## 十、已知限制与改进方向

### 10.1 当前限制

1. **跨月编辑**：修改会议日期跨月时，旧月份文件中的记录不会被自动清理，需手动删除旧文件中的条目
2. **无用户认证**：单用户本地使用，无登录/权限控制
3. **无搜索功能**：只能通过日历浏览查找会议
4. **无全文检索**：content 字段不支持关键词搜索

### 10.2 计划扩展

**语音录制 + AI 转写（优先级：中）**：

- 浏览器端使用 MediaRecorder API 录制音频
- 后端集成 FunASR（Paraformer 中文语音识别 + CAM++ 说话人分离）
- 集成 Ollama + Qwen2.5 进行本地 AI 摘要生成
- 全部本地运行，无需联网

**其他可能的改进**：

- 全文搜索功能
- 标签/分类系统
- 会议纪要模板自定义
- 数据备份/恢复
- 导出为 PDF/DOCX 格式
- 多人协作（如需要可引入 SQLite 替代 JSON）

---

## 十一、维护指南

### 11.1 新增日历视图

1. 在 `CalendarView.vue` 中添加新视图组件引入
2. 在 `v-if/v-else-if` 链中添加对应条件
3. 新组件接收 `currentDate` 和 `meetingsByDate` props，emit `selectDate` 和 `selectMeeting` 事件

### 11.2 新增编辑器工具栏按钮

1. 在 `MeetingEditor.vue` 中添加 `insertXxx()` 函数，调用 `insertAtCursor(before, after)`
2. 在模板工具栏中添加对应按钮

### 11.3 新增 API 端点

1. 在 `server.js` 中添加路由处理函数
2. 在 `useApi.js` 中添加对应方法

### 11.4 修改数据模型

1. 更新 `server.js` 中的 `POST/PUT` 处理逻辑
2. 更新 `MeetingEditor.vue` 中的 `form` 响应式对象
3. 更新 `MeetingDetail.vue` 中的展示逻辑
4. 更新 `meetingToMarkdown()` 导出函数
5. 更新本文档第三章「数据结构」
