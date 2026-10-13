# 首页交互实现与验证 · 2026-10-12

## 已实现

首屏只显示问候、球、哲理话、横排小点和输入框。导航、健康提示与详细行动卡片收进玻璃面板；底部仅保留把手和轻提示。

常规竖屏的问候区域占可用高度约 40%，文字约 79–92px。短屏根据实际可用空间收缩球和留白，极短屏优先避免遮挡。键盘压缩高度时保留球、哲理话与输入，暂时隐藏快捷小点。

每次文字变化触发球的轻微横向伸缩、上浮和光晕脉冲，随后回到慢呼吸；减少动态效果时关闭这些装饰动画。

主区域上滑、把手双向拖动都会直接更新面板位置。松手按距离与速度吸附，边界有轻微阻力。点按把手也可展开；下拉、点背景、收起按钮、Escape 和 Android 返回可关闭。详细内容单独滚动，面板导航切换后返回收起的首页。

毛玻璃使用 Expo 57 BlurView；Android 按版本要求配置 BlurTargetView/blurTarget，SDK31+ 开启原生 blur。Web 保留实际 backdrop-filter，避免给玻璃父层设置动画透明度导致背景变清晰。隐藏内容不响应点按和键盘聚焦，原生使用对应的可访问性隐藏属性。

## 改动位置

- app/src/agent/GlassSheet.tsx：手势、吸附、玻璃层、关闭与可访问性。
- app/src/agent/AgentScreen.tsx：响应式问候、球、引用、横排快捷小点和输入反馈。
- app/App.tsx：首页导航收进面板，保留原有页面状态。
- app/src/components/ui.tsx：玻璃面板中的透明导航和清楚的可访问性标签。

## 已验证

- TypeScript：通过。
- ESLint：0 errors，14 个已有 warnings；本轮未新增 lint 豁免。
- Web 生产导出：通过。
- 10 组 Edge 首页交互检查：包括默认收起、拖动中间位置、吸附、导航返回、逐字输入、减少动态效果、360×640 和内容滚动；无浏览器运行错误。
- CDP 模拟触摸：未松手前跟随位置，上下滑动吸附通过。
- 320×568：快捷小点与输入框不重叠。
- 390×360 模拟键盘高度：球、引用和输入框不重叠。
- 8 组恢复对话浏览器回归与 12 项 Node 对话测试：通过。

## 验证边界

未连接 iPhone/Android 真机；原生键盘、安全区域、刷新率与系统毛玻璃实际观感仍需真机验收。浏览器缩小高度检查不等于原生键盘测试。此轮未改变真实模型、HealthKit、Calendar 和通知的既有可用性。

review-artifacts/home-results.json、home-touch-results.json 记录检查结果，home-collapsed.png、home-expanded.png、home-dragging.png、home-360.png、home-320.png、home-keyboard-height.png 记录布局；目录为本机评审材料，已被 Git 忽略。
