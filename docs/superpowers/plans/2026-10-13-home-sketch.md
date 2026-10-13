# 手绘首页改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 按用户手绘稿实现逐项浮现的问候、季节插画、常驻可录音水球、稳定清晰的玻璃输入框和柔和页面过渡。

**Architecture:** 复用现有 AgentScreen、GlassSheet 和共享草稿。浮现动画独立为 HomeArrival，录音面板独立为 VoiceRecorder，保持现有页面状态和导航入口。

**Tech Stack:** Expo SDK 57、React Native、Reanimated、expo-audio、react-native-svg。

**Spec:** 用户手绘图 C:/Users/LENOVO/AppData/Local/Temp/codex-clipboard-a533e86e-97aa-4b91-b6bc-963a42db7fc0.jpg。

## Global Constraints

- 手机和 Expo Go 优先，保持 8081 与 9301 服务可用。
- 保留工作区已有改动，不重置代码。
- 尊重系统减少动态效果设置，隐藏页面暂停动画。
- 录音请求真实麦克风权限；未接通转写时明确显示能力边界。

### Task 1: 首页视觉和动效

**Files:** app/src/agent/AgentScreen.tsx、HomeArrival.tsx、SeasonIllustration.tsx、HomeDraft.tsx；app/src/recovery/ConversationMotion.tsx；app/App.tsx；app/src/components/TabBar.tsx。

- [x] 分别为问候、主题、观察和追问应用 HomeArrival，初始占位保持布局稳定。
- [x] 常态保留水球，小屏缩小尺寸；绘制随季节变化的山林小插画。
- [x] FlowSurface 增加可选 blurIntensity，首页输入框使用 14，文本保持深色。
- [x] 导航名称改为开始；页面重新显示时使用轻柔形变和淡入。
- [x] 调低 sheet 白色遮罩，展开内容不足时按实际内容控制高度。

### Task 2: 实际录音

**Files:** app/src/agent/VoiceRecorder.tsx、AgentScreen.tsx、app/app.json、app/package.json、app/package-lock.json。

- [x] 通过 expo install 安装 SDK 57 兼容的 expo-audio。
- [x] 水球点击打开录音面板并请求权限；处理拒绝、重复点击、后台中止、最大时长及卸载。
- [x] 停止后可试听、重新录制或关闭，并明确转写尚未接通。

### Task 3: 验证和交付

- [x] 执行 npm exec -- tsc --noEmit 与 npm run lint。
- [x] 运行现有 node 测试，生成 iOS bundle 验证依赖。
- [x] 验证 390×844、375×667 手机视口、展开收起、跟进/习惯切页、详情返回和招新入口，保存截图。
- [ ] 真机验证麦克风权限拒绝、录音和试听；当前习惯列表为空，非空列表仍待实测。
- [x] 确认服务存活和局域网地址，展示 Expo Go 二维码及实际限制。

### Task 4: 其余标签页延续入场动效

**Files:** app/src/components/ContentArrival.tsx、ScreenArrival.tsx、app/src/agent/HomeArrival.tsx、app/src/screens/Others.tsx、app/App.tsx。

- [x] 抽取首页同款浮现动效，保持元素原有布局和减少动态效果行为。
- [x] 跟进、习惯、我的逐项浮现；切换回来时重播，列表操作保持可用。
- [x] 手机视口检查入场结束的布局与切页；运行 lint、类型检查、测试。

## 本轮验证结果（2026-10-13）

- TypeScript 检查通过；lint 0 errors，14 个旧文件 warnings。
- 现有 Node 测试 20/20 通过；iOS bundle 导出成功。
- 已采样跟进列表入场：首行先淡入，后续行错峰启动；结束后均为 opacity 1、translateY 0、scale 1。
- 390×844 的展开面板实测高 427px，375×667 页面与导航正常。
- Expo 8081 与后端 9301 均保持监听，manifest 与 health 返回 200。
- Expo Go 二维码已更新为 exp://10.36.11.75:8081，生成脚本从 manifest 读取当前地址。
- 真机麦克风/试听尚未验证，语音转写未接通；未将打包通过视为真机功能验证。
