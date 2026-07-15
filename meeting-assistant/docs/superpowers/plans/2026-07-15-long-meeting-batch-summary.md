# 长会议分段录音与两级总结实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本地实现多段录音并行转写、按序合并，以及基于分块阶段摘要生成最终会议纪要的完整流程。

**Architecture:** 保留现有录音目录和 `job.json`，将录音任务职责收敛为 ASR-only；前端维护当前会议段列表并轮询各段状态。长文本由共享纯函数按语义边界切块，前端逐块调用短阶段总结接口，最后把阶段摘要交给一次最终总结接口。

**Tech Stack:** Vue 3、Vite、Express、Node.js Test Runner、Vitest、Cloudflare Pages Functions、Ollama `qwen3.5:9b`。

## Global Constraints

- 只修改 `E:\Objects\MeetingRecord\.worktrees\asr-service\meeting-assistant`。
- 不执行 `npm.cmd run deploy`、`wrangler pages deploy`、Cloudflare 迁移或任何正式发布命令。
- 不停止或重启正在使用的 `3001`、`8789`、`11434` 服务；本地冒烟使用 `3011`、`8790`。
- 每项新行为先写失败测试，确认失败后再写生产代码。
- 录音段结束只排队 ASR，不调用 Qwen；最终总结只能在所有录音段完成后启动。
- 阶段块目标为 3000～5000 个汉字；最终纪要目标为约 1500～3000 个汉字，均不做机械硬截断。

## 文件地图

- `server/localRecording.js`: 将现有录音任务结果调整为 ASR-only，提供队列、状态读取和单任务重试所需边界。
- `server.js`: 增加阶段摘要和最终摘要本地 API，保留原短文本 `/api/summarize`。
- `server/ollamaSummarizer.js`: 增加阶段/最终提示词和对应 Ollama 调用，继续默认 `qwen3.5:9b`。
- `shared/longMeeting.js`: 新增独立的转写分块、段落排序和阶段摘要输入规范化纯函数。
- `src/composables/useLocalRecording.js`: 暴露排队、状态读取和等待单段任务的客户端接口，兼容现有调用。
- `src/composables/useSummarizer.js`: 增加阶段摘要编排和最终摘要调用，报告进度并支持从失败阶段重试。
- `src/components/MeetingEditor.vue`: 维护段列表，允许后台转写期间开始下一段，按序合并转写并控制最终总结条件。
- `src/components/MeetingAssistant.vue`: 显示分段状态、处理中数量和“生成总纪要”按钮状态。
- `functions/api/summarize/stage.js`: Cloudflare 阶段摘要转发入口。
- `functions/api/summarize/final.js`: Cloudflare 最终摘要转发入口。
- `tests/local-recording.test.js`: 录音任务 ASR-only 和重试测试。
- `tests/local-recording-client.test.js`: 多段排队和状态轮询客户端测试。
- `tests/long-meeting.test.js`: 分块、排序和总结输入纯函数测试。
- `tests/ollama-summarizer.test.js`: 阶段/最终提示词与请求体测试。
- `tests/summarizer-client.test.js`: 前端阶段编排、顺序和失败重试测试。
- `tests/ui/MeetingAssistant.spec.js`: 助手状态与按钮交互测试。
- `tests/ui/MeetingEditor.spec.js`: 分段录音与最终总结条件测试。

## Task 1: 录音任务改为 ASR-only

**Files:** `tests/local-recording.test.js`, `server/localRecording.js`, `server.js`

- [x] 写失败测试：`startRecordingJob` 在未传 `summarizeFn` 时完成结果仍包含 `transcript`，且 `summarizeFn` 不被调用；已完成任务可读取并返回；失败任务再次调用可以重新进入 `queued`。
- [x] 运行 `npm.cmd run test:server -- --test-name-pattern="ASR-only|retry"`，确认因当前任务仍调用总结或不支持重试而失败。
- [x] 抽取 `transcribeRecordingPipeline` 或等价最小路径，让 `processRecordingJob` 只在明确传入兼容模式时总结；录音 API 默认不传总结函数。
- [x] 增加 `retryRecordingJob` 所需的状态重置，保留原始录音文件和段 ID，禁止已处理任务重复生成不同目录。
- [x] 调整 `server.js` 的 finish 路由使用 ASR-only 队列，并加入 `POST /api/local/recordings/:id/retry`；保持已完成任务幂等返回。
- [x] 运行完整 Node 测试，确认原有单段异步行为和新增行为同时通过。

## Task 2: 共享长文本纯函数与 Ollama 两级提示词

**Files:** `tests/long-meeting.test.js`, `shared/longMeeting.js`, `tests/ollama-summarizer.test.js`, `server/ollamaSummarizer.js`

- [x] 写失败测试：短文本产生一个块；长文本优先在空行/句末切块；超长单段按上限切开；段结果按 `index` 排序；阶段提示词含固定四类字段，最终提示词只接受阶段摘要。
- [x] 运行对应 Node 测试并确认失败原因来自缺少分块函数或提示词。
- [x] 实现 `splitTranscriptIntoChunks(content, { minChars, maxChars })`、`sortCompletedSegments(segments)` 和 `buildSummaryInputs(segments)`，默认 `minChars=3000`、`maxChars=5000`，短文本不填充。
- [x] 实现 `buildStageSummaryPrompt`、`buildFinalSummaryPrompt` 和 `summarizeStageWithOllama`、`summarizeFinalWithOllama`；沿用 `think: false`、`keep_alive`、模型默认值和思考块清理。
- [x] 运行 Node 测试并检查请求体没有把原始长文放入最终提示词。

## Task 3: 阶段/最终摘要 API 与云端转发入口

**Files:** `tests/summary-api.test.js`, `server.js`, `functions/api/summarize/stage.js`, `functions/api/summarize/final.js`

- [x] 写失败测试：本地阶段接口接收单块并返回模型名；本地最终接口拒绝空摘要列表并返回最终纪要；请求缺少内容时返回 400。
- [x] 运行测试确认新路由尚不存在。
- [x] 在 Express 中添加 `POST /api/summarize/stage` 和 `POST /api/summarize/final`，阶段接口只处理一个块，最终接口只接收带序号阶段摘要并按序组装。
- [x] 在 Pages Functions 中使用现有授权和 `proxyModelGatewayRequest` 添加同路径转发，保持未来正式发布的接口形状一致；不运行 Wrangler。
- [x] 运行 Node 测试和现有总结测试。

## Task 4: 本地录音客户端支持后台轮询

**Files:** `tests/local-recording-client.test.js`, `src/composables/useLocalRecording.js`

- [x] 写失败测试：`queueRecording` 只请求 finish 并立即返回；`getRecordingStatus` 请求 status；`waitForRecording` 能把 queued/processing 轮询到 completed，并在 failed 时抛出原错误；两个段的轮询互不阻塞。
- [x] 运行客户端测试确认新接口不存在。
- [x] 实现三个接口，保留 `finishRecording` 作为等待完成的兼容封装；retry 请求复用相同状态读取。
- [x] 运行客户端测试和完整 UI 测试。

## Task 5: 前端分段录音和按序合并

**Files:** `tests/ui/MeetingEditor.spec.js`, `src/components/MeetingEditor.vue`, `tests/ui/MeetingAssistant.spec.js`, `src/components/MeetingAssistant.vue`

- [x] 写失败测试：第一次录音排队后再次点击可以开始第二段；第一段处理中时按钮不禁用；完成顺序为第二段先完成时，编辑器仍按第一段、第二段顺序呈现；失败段显示重试操作。
- [x] 运行 UI 测试确认当前 `isFinishingRecording`/单结果流程导致失败。
- [x] 增加 `recordingSegments` 状态和每段的 `index/status/transcript/error`，停止录音时等待上传后只调用 `queueRecording`，随后独立启动轮询；清理当前 MediaRecorder 状态但不清理段列表。
- [x] 以 `sortCompletedSegments` 结果重建录音转写区，保留段分隔；将“生成总纪要”禁用条件改为仍在录音、上传中、转写未完成或已有总结运行。
- [x] 助手面板展示 `第 N 段：排队中/转写中/已完成/失败`、处理中数量和明确的“生成总纪要”文案；录音按钮只在当前录音/上传临界区禁用。
- [x] 为失败段接入单段 retry，并验证重试成功后可以解除总纪要禁用。

## Task 6: 前端两级总结编排与保存

**Files:** `tests/summarizer-client.test.js`, `src/composables/useSummarizer.js`, `src/components/MeetingEditor.vue`

- [x] 写失败测试：长文本按块顺序请求 stage；全部 stage 完成后才请求 final；stage 失败不请求 final 且报告失败索引；final 失败可单独重试。
- [x] 运行客户端测试确认当前只有单次 `/summarize` 调用。
- [x] 实现 `summarizeLongMeeting`：切块、逐块 stage、通过回调报告进度、收集摘要后 final；阶段摘要保留在组件状态，最终只替换 `form.summary`，不覆盖 `form.transcript`。
- [x] 修改 `handleSummarize` 使用长流程；没有未完成段时允许手动文本走一个短块，但存在录音批次时必须先完成全部段。
- [x] 验证保存、自动保存和导出仍使用最终 summary + 完整 transcript 的既有序列化格式。

## Task 7: 本地验证与进度记录

**Files:** `PROJECT_PROGRESS.md`（工作树根目录，如不存在则创建）

- [x] 运行 `npm.cmd test`，记录 Node 与 UI 通过数量。
- [x] 运行 `npm.cmd run build`，确认 Vite 构建通过。
- [x] 使用备用端口启动本地服务：`$env:PORT=3011; $env:ASR_BASE_URL='http://127.0.0.1:8790'; npm.cmd start`；使用测试网关或测试替身验证 finish 立即返回、两个段可并行轮询、stage/final API 可调用。
- [x] 运行 `git diff --check`，检查工作树状态，确认没有执行正式部署，也没有触碰 `3001`/`8789`。
- [x] 更新 `PROJECT_PROGRESS.md` 的当前快照、验证基线、进行中事项、下一步和变更日志，只记录本地验证事实。

## Verification Checklist

- [x] `npm.cmd test` 通过。
- [x] `npm.cmd run build` 通过。
- [x] `git diff --check` 通过。
- [x] 本地备用端口冒烟通过。
- [x] 正式站点未重启、未部署、未修改远程数据。
