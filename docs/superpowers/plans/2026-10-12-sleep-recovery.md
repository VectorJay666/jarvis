# 睡眠与恢复对话迁移 Implementation Plan

> 执行记录：本次在当前会话本地实施，无提交、推送或部署。

**Goal:** 在现有 Expo 应用中接入健康页睡眠 skill 入口、可持续更新的对话卡片和真实模型接口，并明确隔离演示。

**Architecture:** 保留首页和现有功能。RecoveryScreen 使用本地持久化多轮上下文；真实模式调用新 `/v1/recovery/talk`，后端读取 sleep skill 和证据目录调用现有 DeepSeek 客户端，结构化验证输出。无模型时只提供有标签的预设交互演示。日历和 HealthKit 尚未实现，不伪造授权成功。

**Tech Stack:** Expo 57 / React Native 0.86 / TypeScript / Node HTTP / DeepSeek compatible API.

**Spec:** 用户提供《睡眠与恢复助手-对话与需求总结.md》，只作为产品要求参考；参考网站已在浏览器打开。

## Global Constraints

- 黑白、系统字体、少量层次、44pt 可点目标，保持现有首页留白。
- 简短回答、相关卡片、便捷回复；一次通常只问一个问题。
- 不把模拟健康数据标记为 HealthKit；缺失值不使用演示值填充。
- 不自动设置系统通知；真实通知必须有明确时间、成功回执、取消能力。
- 不声称当前已接入 Apple Calendar；读取失败后可自由描述。
- 真模型缺失或失败明确显示，不能退回规则并宣称是真 Agent。
- 文献限定已整理目录，不允许模型凭空生成论文 URL。

### Task 1: 服务和 skill

**Files:** `skills/sleep-recovery/SKILL.md`, `app/src/recovery/evidence.json`, `server/recovery.mjs`, `server/recovery.test.mjs`, `server/council.mjs`.

**Interfaces:** `recoveryStatus(): {configured, model}`, `runRecovery(body): Promise<Response>`, `validateReply(raw): Response`；请求携带 messages / health / calendar / reminder_receipts / local_time / timezone。日历明确不可用；不信任客户端通知回执，模型仅提出提醒请求，由 App 取得真实通知 ID。

- [x] 写 skill：先回应，保留约束，区分记录来源和基线，引用支持具体建议的条目。
- [x] 实现真实模型请求和结构验证。检查卡片引用 ID 白名单、提醒时间、模型最终回复结构。
- [x] 接入 `GET /v1/recovery/status`、`POST /v1/recovery/talk`；未配置 503，坏输入 400，模型失败 502。
- [x] `node --test server/recovery.test.mjs` 检验恶意结构、历史、来源和失败行为。

### Task 2: 应用体验

**Files:** `app/src/recovery/{types.ts,demo.ts,client.ts,RecoveryScreen.tsx}`, `app/src/agent/{AgentScreen.tsx,notify.ts}`, `app/src/talk/{HealthFollow.tsx,healthSnapshot.ts}`.

**Interfaces:** `<RecoveryScreen visible snapshot initialText openRealConversation onClose />`；演示和真实会话分别存储；卡片附 evidence_ids 和依据，模型仅返回可展示内容。

- [x] 实现早晨、傍晚、今晚预设演示；自由输入保留用户消息，未知输入明确说明演示范围。
- [x] 实现模态专门对话、可更新卡片、依据展开、引用链接、状态和模式切换。
- [x] 在健康页下方接入 skill，在首页输入和睡眠卡提供入口。
- [x] 移除启动自动通知和假 HealthKit 连接；真实通知使用 ID 回执并支持取消。
- [x] `npm exec tsc -- --noEmit` 和 `npm exec expo -- lint`；浏览器测试 390/360px、键盘输入、展开依据、多轮演示、返回重开和网络失败。

### Task 3: 交付

**Files:** `docs/recovery-review.md`, `README.md`.

- [x] 实际运行网页和后端，保存原版与新版截图。
- [x] 记录运行地址、已迁移内容、真实 Agent / HealthKit / Calendar / 通知的验证边界。
- [x] `npm run export` 确认 Web 发布构建；不推送、不发布。

## 完成记录

TypeScript 通过；Lint 0 errors / 14 个旧代码 warnings；12 个 Node 测试与 8 组浏览器流程通过；Web export 成功。实际模型和 iPhone 原生能力未验证，详见 docs/recovery-review.md。
