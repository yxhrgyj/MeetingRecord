# 会议记录助手

一个基于日历的会议记录管理工具，支持电脑和安卓手机使用，数据实时同步。

## 功能

- 月/周/日三种日历视图，直观查看每日会议
- 点击日历日期即可创建会议记录
- 预设记录模板（通用会议 / 项目会议 / 客户会议）快速录入
- 支持参会人员、议题、记录、结论、待办事项等完整字段
- PWA 可安装到桌面和手机主屏幕
- 离线也可查看已缓存的会议记录
- 数据通过 Supabase 云端实时同步

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

1. 前往 [supabase.com](https://supabase.com) 注册账号并创建项目
2. 在项目的 SQL Editor 中执行 `supabase/schema.sql`，创建数据库表
3. 在项目 Settings → API 中获取 `URL` 和 `anon key`
4. 将 `supabase/schema.sql` 在 Supabase SQL Editor 中运行

### 3. 创建环境变量

复制 `.env.example` 为 `.env` 并填入实际值：

```bash
cp .env.example .env
```

编辑 `.env`：

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon-key
```

### 4. 启动开发服务器

```bash
npm run dev
```

浏览器访问 `http://localhost:5173` 即可使用。

### 5. 构建部署

```bash
npm run build
```

构建产物在 `dist/` 目录，可部署到任意静态托管平台：
- **Vercel**：`vercel --prod`
- **Cloudflare Pages**：上传 dist 目录
- **Netlify**：拖拽 dist 目录即可

### 6. 安装为 PWA

Chrome/Edge 浏览器打开部署后的地址，地址栏会出现安装图标，点击即可安装。

Android 手机用 Chrome 打开，会自动弹出安装提示（或在菜单中选择"添加到主屏幕"）。

## 技术栈

- Vue 3 + TypeScript + Vite
- Naive UI 组件库
- FullCalendar 日历组件
- Supabase 后端服务
- IndexedDB (Dexie.js) 离线缓存
- PWA (vite-plugin-pwa)
- Pinia 状态管理
