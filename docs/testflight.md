# TestFlight 测试发布

TestFlight 能让测试者在 iPhone 上安装独立运行的测试应用，无需开着 Mac 或 Expo 开发服务。它属于测试分发；每个构建的测试期限通常是 90 天，后续通过新构建继续测试，正式 App Store 发布是另一条流程。

采用 EAS 云端构建和 EAS Submit 上传时，Windows、Mac 或 Linux 均可发起，不要求本机安装 Xcode。Mac 主要用于本地模拟器和原生调试；有 iPhone 就可以安装 TestFlight 测试云端产物。

本版已增加 `app/eas.json` 的 production 构建与上传配置，以及 `app/app.config.js` 的在线后端校验。2026-10-12 已创建并关联 EAS 项目 @vector6/jarvis-secretary（项目 ID：c7cbb201-01a3-4f0a-91a9-bb72a80310ca）。Apple 签名、在线后端部署和构建上传仍待完成。

## 先完成两项准备

1. **Apple Developer Program 账号**：TestFlight 使用付费开发者计划。免费 Personal Team 可以用于有限的个人真机调试，不能作为 TestFlight 分发账号。登录和二步验证在你自己的设备上完成。
2. **长期在线的 Jarvis 后端**：手机要能从外网访问一个 HTTPS 地址，例如 `https://jarvis-api.example.com`。这是运行 `server/council.mjs` 的应用后端，**不是**模型提供商的 `https://ai.xem8k5.top/v1`；客户端仍调用 Jarvis 的 `/v1/assistant/stream` 等接口，模型密钥只放后端。

部署服务需要 Node.js 24、启动命令 `node server/council.mjs` 和上述服务端环境变量。服务器会读取托管平台提供的 `PORT`，默认监听 `0.0.0.0`。平台应支持长连接流式响应，代理不要缓存回复，模型调用可持续约 30 秒。当前后端还使用本地 JSON 保存状态：重启需要持久存储，也没有登录和用户隔离，先供你个人测试；邀请多个用户使用真实个人数据前需要补这些能力。

本地 Mac 的 `9301` 地址可以用于模拟器/同 Wi-Fi 真机测试；手机离开网络后无法访问，不能替代在线后端。

## 1. 在当前电脑打开代码（Windows / Mac 均可）

使用这次代码包，或在已同步到当前版本的 Git 仓库中操作。代码包没有 `.git`：如果 EAS 提示初始化 Git 仓库，按提示在本地初始化并保存一次源码即可。不要把 `server/.env` 加入 Git。

Windows 当前工作目录：

```powershell
cd C:\Users\LENOVO\Documents\ChatGPT\Jarvis\app
npm ci
npx eas-cli@latest login
npx eas-cli@latest init
```

Mac 使用 `cd ~/Projects/Jarvis/app`，后续命令相同。

当前 Windows 工作区已登录并关联，无需重复 login/init。上面的步骤供新电脑使用。`init` 将项目关联到你的 Expo 账号并写入项目 ID。不要使用别人账号的项目 ID。初次构建按提示配置签名即可；已有 `eas.json` 无需另行覆盖。

## 2. 配置发布后端地址

将下面占位地址替换为你的实际 Jarvis HTTPS 后端：

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_BASE --value https://jarvis-api.example.com --environment production --visibility plaintext
```

这个地址是公开配置，不是密钥。`DEEPSEEK_API_KEY` 只配置到运行后端的托管服务，不能上传为客户端的 `EXPO_PUBLIC_*` 变量。

先从手机外网检查后端 `/health`，再验证首页发送消息能收到完整的流式回复。只出现 `configured: true` 不足以证明模型账号可正常使用。

发布配置会在缺少 HTTPS 地址或使用 localhost / 私有局域网地址时拒绝构建，并移除本地测试专用的局域网用途说明和 HTTP 例外。此检查只能检查地址格式，不能代替联网测试。

## 3. 创建 App Store Connect 应用

在 App Store Connect → My Apps 新建 iOS 应用，填写名称、语言和唯一的 SKU；Bundle ID 对应 `app.json` 的 `com.jarvis.secretary`。如果该标识不归你的开发者账号所有，先改为自己唯一的标识，之后在 Apple 开发者账号中注册并匹配。

在应用的 App Information 页面找到数字形式的 Apple ID，可填写到 `app/eas.json`：

```json
"submit": {
  "production": {
    "ios": {
      "ascAppId": "填入你自己的数字应用ID"
    }
  }
}
```

不确定时先保留当前空配置，上传命令会提示选择/配置目标应用。

## 4. 构建，再上传

```bash
npx eas-cli@latest build --platform ios --profile production
```

初次构建会要求你的 Apple 账号和签名配置；在你自己的终端完成登录及二步验证，可以让 EAS 按提示管理证书。production 构建内嵌页面代码，无需运行 Metro。

构建成功、确认版本正确后：

```bash
npx eas-cli@latest submit --platform ios --profile production
```

选择刚刚完成的对应构建上传。这里刻意不用 `--latest`，避免有多个构建时选错。上传后等待 Apple 处理，在 App Store Connect 的 TestFlight 页面查看状态，并按实际情况填写出口合规和测试信息。

## 5. 先给自己，再给朋友

- **自己测试**：在 App Store Connect 中为自己的账号建立内部测试组，添加构建，iPhone 安装 TestFlight 后接受邀请。
- **朋友测试**：建立外部测试组、添加构建并完成 Apple 要求的 Beta App Review；通过后用邮箱或公开邀请链接邀请。不要为了发给朋友而赋予他们 App Store Connect 管理权限。

内部测试不等于面向普通用户的正式上架。测试者安装后，应用可以直接打开；AI 对话依赖在线后端可用。本版 HealthKit / Apple Calendar 尚未接入；TestFlight 安装不会自动补上这些能力。

每次修改后再次构建和上传，配置会远程自动增加构建号。界面版本号仍由 `app.json` 的 `version` 管理。

## 当前已验证与剩余工作

已验证：Windows 本机的 TypeScript、lint（0 错误，14 个既有警告）、20 项协议与功能测试、Web 导出、iOS JS/Hermes bundle 导出、浏览器首页手势和流式交互，以及 5 项真实首页意图测试。

仍需：EAS 云端 iOS 原生编译及签名（或任选 Mac 本地编译）、iPhone 原生效果与通知实测、在线后端部署、你的 Expo/Apple 账号关联和 TestFlight 上传。iOS bundle 导出成功不代表 Xcode 签名与原生编译已经完成。

## 官方参考

- Expo iOS 上传：https://docs.expo.dev/submit/ios/
- Expo 构建：https://docs.expo.dev/build/setup/
- Expo 发布环境变量：https://docs.expo.dev/eas/environment-variables/manage/
- Apple TestFlight：https://developer.apple.com/testflight/
- Apple 开发者计划对比：https://developer.apple.com/support/compare-memberships/

## 2026-10-12 本轮部署准备

已补齐 react-native-worklets，并迁移 expo-splash-screen 插件配置。Expo Doctor 21/21 通过；TypeScript 通过；lint 0 错误、14 个既有警告；iOS JS/Hermes bundle 导出通过。当前 8081 页面、9301 后端均在本机运行。尚无签名 IPA、线上后端或 TestFlight 构建；下一步确认 Apple 开发者会员和后端托管资源。旧源码 ZIP 不包含这次账号关联和依赖修正，以当前工作区为准。
