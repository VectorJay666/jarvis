# 玻璃对话与主动开场 Implementation Plan

> **For agentic workers:** Execute the checked tasks inline in the current authorized task; no delegation is required.

**Goal:** 首页先反馈已知状态，并提供可点选的跟进；睡眠页及首页对话统一毛玻璃，选项在输入框上方竖排并随键盘移动。

**Architecture:** 保留现有 Expo / 流式对话结构。FlowSurface 统一玻璃背景与进出布局动画；共享 FloatingChoices 组件处理竖排点选；纯函数生成有来源标识的首页开场。

**Tech Stack:** Expo 57、React Native、expo-blur、Reanimated、TypeScript。

**Spec:** 本会话用户 2026-10-12 的截图与三点交互要求。

## Global Constraints

- 点选最多三项，保留自由输入、忙碌禁用、停止回复和重试。
- mock 标识为演示；只有真实个人基线才能比较变化；缺失和过期数据不推断健康变化。
- 减少动态效果时停用装饰动画；Android 使用现有 BlurTargetView 模式。
- 键盘弹起时选项与输入同一个布局区域；短屏选项可滚动，不遮挡最后一条消息。

### Task 1: Shared glass and choice surfaces

**Files:** app/src/recovery/ConversationMotion.tsx; app/src/recovery/FloatingChoices.tsx.
**Interfaces:** FlowSurface consumes optional blurTarget and animates entry/layout. FloatingChoices consumes string[], disabled, onChoose(text), testIDPrefix, blurTarget.

- [ ] 增加 BlurView、渐变高光、玻璃边缘，不加入每条气泡永久动画。
- [ ] 每个选项占一行，至少 44px，整行可点，长文字换行，短屏滚动。
- [ ] 用 TypeScript 与 Web 页面检查共享组件。

### Task 2: Grounded opening and home follow-up

**Files:** app/src/recovery/opening.ts; app/src/agent/AgentScreen.tsx; HomeConversation.tsx; HomeDraft.tsx; server/assistant.mjs; skills/sleep-recovery/SKILL.md; app/tests/opening.test.cjs.
**Interfaces:** conversationOpening(HealthSnapshot, scope, now) returns { label, observation, question, choices }. Homepage submits a choice as a normal user message.

- [ ] 根据有效记录与真实个人基线反馈变化；演示、数据缺失、历史不足明确说明。
- [ ] 首页展示开场主题；首轮与后续 quick_replies 都可在输入框上方点选。
- [ ] 问题优先附两至三个具体选项；不自动请求模型。
- [ ] 验证缺失、mock、真实比较、过期和不同主题数据。

### Task 3: Recovery floating composer

**Files:** app/src/recovery/RecoveryScreen.tsx.

- [ ] 用玻璃替换聊天气泡、卡片、输入框与选项。
- [ ] 底部输入区绝对定位，实测高度作为滚动内容下方间距。
- [ ] 无历史时显示恢复主题开场；回复到来时选项平滑替换。
- [ ] 运行 TypeScript、lint、现有对话测试与 Web 导出；浏览器检查普通/短屏、点选、流式回复、滚动与减少动态效果。
