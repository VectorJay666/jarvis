# iOS 部署测试计划

> **For agentic workers:** 在当前会话逐步执行；不创建子代理。账号登录由用户在自己的设备完成。

**Goal:** 将当前 Jarvis 制作成可安装、可连接在线 AI 后端的 iPhone 测试应用。

**Architecture:** Expo EAS 云端构建与签名；手机连接独立的 Jarvis HTTPS 后端。先解决原生构建检查，再关联真实账号和后端，最后构建上传与真机验收。

**Tech Stack:** Expo SDK 57、React Native 0.86、Node.js 24、EAS Build / Submit。

**Spec:** 用户要求开始部署测试，并要求逐步解释操作。

## Global Constraints

- 保留现有未提交修改；不提交密钥，不购买服务。
- 密码与验证码由用户自己填写。
- JS bundle 导出不等于签名原生包或真机验证。
- 当前共享状态、未登录的后端不能直接作为多人正式服务。

### 1. 本机打包准备

**Files:** `app/app.json`、`app/package.json`、`app/package-lock.json`。

- [x] 检查 8081 页面与 9301 后端：两者返回成功。
- [x] 运行 `npx expo-doctor`：发现旧 splash 字段及 react-native-worklets 缺失。
- [x] 运行 `npx expo install react-native-worklets expo-splash-screen`；手动将旧 splash 配置迁移到插件（动态配置不能自动写入）。
- [x] Expo Doctor 21/21 通过；TypeScript 通过；lint 0 错误、14 个既有警告；iOS JS/Hermes bundle 导出通过（不等于原生签名包）。

### 2. 云端账号与后端

**Files:** `app/app.json` 的 EAS 项目关联；现有 `app/eas.json`、`docs/testflight.md`。

- [x] 运行 `npx eas-cli@latest whoami`：个人 Expo 账号 vector6 已登录。
- [x] 已创建并关联 @vector6/jarvis-secretary，ID c7cbb201-01a3-4f0a-91a9-bb72a80310ca；project:info 确认成功。
- [ ] 确认用户 Apple 开发者会员及后端托管账号/服务器；不能虚构外部账号。
- [ ] 在已确认服务器运行 `node server/council.mjs`，配置服务端模型环境、持久存储与个人测试访问方式；验证 HTTPS /health 和真实流式聊天。
- [ ] 使用 `npx eas-cli@latest env:set` 配置实际已验证的 EXPO_PUBLIC_API_BASE。

### 3. 构建和手机验收

- [ ] `npx eas-cli@latest build --platform ios --profile production`；用户自行处理签名登录与二步验证。
- [ ] 构建成功后 `npx eas-cli@latest submit --platform ios --profile production`，选择对应构建。
- [ ] TestFlight 真机测试：面板跟手、键盘、流式动画、毛玻璃、外网 AI 连通性。

未完成签名与上传时，不宣称已部署或已生成安装包。

## 最新用户约束与执行方向

用户没有 Apple 开发者会员或云服务器；可用 Mac 较旧、版本未知；工作室电脑可能不适合登录个人账号。因此暂缓 TestFlight 构建与上传，不新增登录。先使用 Windows 作为局域网页面与 AI 后端服务器，iPhone Safari 测试。当前 Expo 项目登记保留，不再调用云端账号操作。后续原生安装需要确认 Mac 是否兼容或取得开发者会员。详见 `docs/local-phone-testing.md` 和 `docs/superpowers/plans/2026-10-12-local-phone-test.md`。
