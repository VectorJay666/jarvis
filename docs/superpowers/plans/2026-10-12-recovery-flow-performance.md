# 睡眠对话速度与动效 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 更快看到真实回复，让等待、文字和卡片流动展开，并把对话作为睡眠模块的模式。
**Architecture:** 保留现有状态导航和结构化回复。模型生成时仅透出 JSON 顶层 reply 的可见文字，完整输出校验后再展示卡片；NDJSON 连接支持取消和明确失败。客户端使用 Expo 57 流式 fetch、已有 Reanimated 和 BlurView，不加依赖。
**Tech Stack:** Node HTTP、OpenAI-compatible Chat Completions、Expo 57、React Native、Reanimated 4.5。
**Spec:** 本轮用户要求：响应更快、动效更流动且有苹果风格、不要单列 skills，直接作为睡眠模块模式。

## Global Constraints
- 密钥只在被 Git 忽略的 server/.env；日志不包含密钥。
- 不改变健康事实、提醒确认、证据校验规则，不把推理内容当回复。
- 保留现有非流式接口以兼容其他调用与旧客户端。
- 用户往上查看历史时不强制滚到底；减少动态效果关闭装饰动画。
- 手机优先；类型检查和 lint 必须通过；不提交或推送。

### Task 1: 实测模型并优化配置
**Files:** server/.env (local only), server/llm.mjs, review-artifacts/model-latency.mjs (ignored)
**Interfaces:** chat({onDelta?, signal?, ...}) -> Promise<string|object|null>；onDelta(text) 为累积的最终内容字段，不含内部推理。
- [x] 同一真实任务测第一段可见回复、整体时间与结构有效性，记录模型和推理设置。
- [x] 选择实际可调用且回复有效的低延迟设置，保留测量结果。

### Task 2: 流式恢复接口
**Files:** server/stream.mjs, server/recovery.mjs, server/council.mjs, server/recovery.test.mjs
**Interfaces:** POST /v1/recovery/stream -> NDJSON {type:'reply',text} | {type:'complete',result} | {type:'error',message}。
- [x] 实现按块解析 SSE 与 JSON 顶层 reply，覆盖 UTF-8、转义、分块、错误和内部推理过滤。
- [x] 新增可取消流式接口，完整结果经 validateReply；失败不保存半截为正式回复。
- [x] 有意义的解析与协议测试通过。

### Task 3: 睡眠模式与连贯动效
**Files:** app/src/recovery/client.ts, app/src/recovery/stream.ts, app/src/recovery/ConversationMotion.tsx, app/src/recovery/RecoveryScreen.tsx, app/src/talk/HealthFollow.tsx, app/src/agent/AgentScreen.tsx
**Interfaces:** askRecovery(messages,health,{onReply?,signal?}) -> Promise<Reply>。
- [x] 接入真实流式内容；即时显示等待球，接收正文平滑更新，消息和卡片弹簧进入；输入栏磨砂，打字时球回应。
- [x] 关闭会话/取消/超时不丢用户消息，保留重试；自动滚动只跟随底部。
- [x] 去掉产品中的 skill/Agent 术语，睡眠模块内呈现“陪我调整 / 体验示例”。有服务配置时默认真实对话，示例明确区分。

### Task 4: 验证与交付
**Files:** app/tests/recovery.test.cjs, review-artifacts/* (ignored), docs/recovery-performance-review.md
- [x] 后端协议与既有测试、TypeScript、lint、Web 导出。
- [x] 浏览器验证等待、生成中间状态、完整卡片、错误/重试、关闭取消、查看历史不跳底、减少动效及小屏。
- [x] 重启服务，真实接口测量和截图，说明只在本机测试过的边界。

### Task 5: 首页意图入口（追加用户要求）
- [x] 首页通过单次模型调用理解意图并回答，明确的睡眠问题才进入睡眠模式，其他主题在首页对应模式回应。模糊、多主题或低置信度不跳页。
- [x] 保留完整会话，睡眠交接带已有回复，避免重复调用；验证否定词、模糊意图和多主题。

## 交付补充

已增加 Mac 原生测试指南、EAS TestFlight production 配置与云端发布指南。账号关联、在线后端部署、云端签名编译和实际上传仍待配置条件；未进行发布。Windows 已通过 iOS JS/Hermes bundle 导出，不能替代原生编译。
