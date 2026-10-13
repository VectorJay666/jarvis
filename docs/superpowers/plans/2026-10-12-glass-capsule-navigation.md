# 玻璃胶囊导航 Implementation Plan

> 本轮已获用户授权，直接在当前会话执行并启动 Expo Go 局域网服务。

**Goal:** 五项导航成为悬浮玻璃胶囊，选中高亮随页面切换滑动，手机可连接测试。

**Architecture:** 独立 TabBar 负责视觉与命中区域。App 持有唯一共享选中位置，主页面板与普通页面使用同一位置；内容先渲染到 BlurTargetView，导航浮在其上，滚动内容预留底部空间。

**Tech Stack:** 已安装的 Expo 57、expo-blur、Reanimated 4、React Native；无新增依赖。

**Spec:** 用户 2026-10-12 在当前会话授权玻璃胶囊改造，随后要求直接启动 Expo Go 手机测试服务。

## Global Constraints

- 保留首页收起时隐藏导航、上滑后显示导航的交互。
- 保留已有未提交修改、业务接口和会话状态。
- 尊重减少动态效果设置；每项触控高度不小于 44px。
- 完成 lint、TypeScript 和浏览器交互验证。

### Task 1: 玻璃胶囊和共享高亮

**Files:** 新建 app/src/components/TabBar.tsx；修改 app/src/components/ui.tsx、app/App.tsx、app/src/agent/AgentScreen.tsx、app/src/agent/GlassSheet.tsx。

**Interfaces:** `useTabIndicator(value: TabKey): SharedValue<number>`；`tabBarInset(bottom: number): number`；`TabBar` 接受 value、onChange、bottom、indicator、blurTarget、glass；GlassSheet 的 footer 接收 close 和内容 blurTarget，footerInset 为滚动预留高度。

- [x] 添加 64px 高度玻璃容器、圆角、透光边缘、柔和阴影和 5 个等宽点击区域。共享位置按标签序号动画，通过实测容器宽度定位高亮。
- [x] 在 App 使用共享高亮，普通页面导航绝对定位；CTA 放在胶囊上方，滚动末尾预留导航及 CTA 高度。
- [x] 在 GlassSheet 将滚动内容作为独立 blurTarget，footer 悬浮；主页传递同一个 indicator 和当前页面值。
- [x] 检查快速切换、返回首页、详情返回、减少动态效果、320/360/390px 和短屏的布局与选中状态，保存截图。

### Task 2: 验证和启动手机服务

**Files:** review-artifacts/glass-nav-smoke.cjs、review-artifacts/glass-nav-results.json、review-artifacts/glass-nav-*.png、review-artifacts/expo-go-connection.json。

- [x] 在 app 执行 `npx tsc --noEmit`、`npm run lint`。
- [x] 执行玻璃导航浏览器验证和已有 home-smoke.cjs；修复本轮引入的问题。
- [x] 检查现有 8081 Expo 进程，使用 Expo Go LAN 模式启动或复用；请求 iOS manifest 和后端 health，确认返回 LAN 主机地址。
- [x] 生成指向实际 exp:// 地址的二维码，交付手机扫码入口与真机待确认项。

**验证结果：** 9 组胶囊导航检查、10 组主页回归通过，无浏览器运行错误。TypeScript 通过；lint 为 0 errors、14 条原有 warnings。局域网 Expo Go 服务复用已有 `expo start --lan --port 8081 --clear` 进程，iOS manifest 和原生 bundle 返回 200，后端 9301 health 正常且模型配置就绪。地址与二维码位于 review-artifacts/expo-go-connection.json 和 expo-go-qr.png。原生毛玻璃观感、系统键盘与手机局域网连接由用户本轮真机测试确认。
