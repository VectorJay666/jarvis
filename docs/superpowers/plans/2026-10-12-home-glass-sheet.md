# 首页问候与玻璃面板实现计划

> 在当前会话继续执行。依据用户本轮要求；附件中的内容仅作背景资料。

**目标：** 首屏简洁、问候区域约占屏幕 40%、横向小点、保留哲理话；详情上滑展开并跟手，输入时球有律动。

**架构：** 保留现有状态导航和恢复对话。GlassSheet 独立管理手势、玻璃层、弹簧吸附和可访问性；AgentScreen 提供首屏和详情；App 将首页导航收进面板。

**技术：** Expo 57 / React Native / Gesture Handler 2 / Reanimated 4 / expo-blur。无新增依赖。

- [x] 1. 阅读匹配 Expo 57 的 blur 文档、手势和 spring 文档；确认 Android 的 BlurTargetView 和 blurTarget。
- [x] 2. 新建 app/src/agent/GlassSheet.tsx。默认仅露把手；主区域上滑和把手双向拖动直接更新位置；速度与距离决定吸附；支持点按、Escape/Android 返回、减少动态效果、详情独立滚动。
- [x] 3. 修改 AgentScreen.tsx：响应式大问候区域、128px 球、哲理话、三个水平小点、输入脉冲；将 nudge/actions/answer 收进详情，保持健康/形象/恢复对话。
- [x] 4. 修改 App.tsx 与 ui.tsx：首页隐藏外部 TabBar，在详情底部显示透明 TabBar，切换页面后仍可返回首页。
- [x] 5. Edge 浏览器验证收起/拖动中间位置/吸附/关闭/导航/打字/窄屏/减少动态效果。截图检查布局与玻璃。
- [x] 6. TypeScript、lint、12 项对话测试、恢复浏览器回归、web 导出；记录实际限制和验证结果。

**验收：** 首屏不显示详情卡片与导航；上滑无需松手就可看到位置连续变化；关闭后不可点击隐藏内容；输入反馈不依赖发送；问候与引用均可见；360px 和短屏无溢出。

**边界：** 当前可验证 Edge/web 交互，原生键盘和 iOS/Android 毛玻璃观感需真机确认。

**实际结果：** 类型检查、lint（0 errors，14 个现有 warnings）、Web 导出均通过。10 组首页流程、触摸拖动与额外短屏检查、8 组睡眠对话回归、12 项 Node 测试通过。截图和记录位于 review-artifacts/。
