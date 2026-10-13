# Mac 与 iPhone 测试步骤

这份指南对应 2026-10-12 的本地代码。当前修改尚未推到 GitHub，直接克隆远端会拿到较早版本。请使用 `Jarvis-Mac-test-2026-10-12.zip`，解压后得到 `Jarvis` 文件夹。代码包不包含密钥、依赖、个人运行数据或生成的原生工程。

如果只想安装独立运行的测试版，可直接按 [TestFlight 云端构建指南](testflight.md) 在 Windows 操作；Mac 不是云端打包的前提。下面用于本地模拟器和真机调试。

## 1. 准备 Mac

1. 从 Mac App Store 安装 Xcode，首次打开并完成组件安装。
2. 在 Xcode → Settings → Locations 选择 Command Line Tools；在 Components 中安装一个 iOS 模拟器运行时。
3. 安装 Node.js 24，至少 24.3。项目锁定 Expo 57 / React Native 0.86.3，先保留现有依赖版本。
4. 在终端确认：

```bash
node -v
npm -v
xcodebuild -version
xcode-select -p
```

如果开发工具目录没有指向完整 Xcode：

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
```

CocoaPods 用于安装 iOS 原生依赖；第一次构建时 Expo 会检查它。如果提示缺少 CocoaPods，已安装 Homebrew 的 Mac 可执行 `brew install cocoapods`，然后重试。

## 2. 配置后端

假定把解压后的 `Jarvis` 放进了 `~/Projects/`。如果放在其他位置，将下面的路径替换为实际路径。

在终端 A：

```bash
cd ~/Projects/Jarvis
cp server/.env.example server/.env
open -e server/.env
```

把文件内容改为以下配置，密钥从你自己的保存位置填入：

```dotenv
DEEPSEEK_API_KEY=填入你自己的密钥
DEEPSEEK_BASE_URL=https://ai.xem8k5.top/v1
DEEPSEEK_MODEL=gpt-6-sol
DEEPSEEK_REASONING_EFFORT=low
```

这些是后端历史变量名，可以连接目前的兼容接口。不要将密钥填入 `EXPO_PUBLIC_*`、客户端代码或截图。未配置密钥时，睡眠模块里的“体验示例”仍可使用。

保存后启动：

```bash
node server/council.mjs
```

保持这个终端开着。终端显示监听 `0.0.0.0:9301` 后，在 Mac 浏览器打开 `http://127.0.0.1:9301/health`；出现 JSON 表示后端可访问。另可打开 `http://127.0.0.1:9301/v1/recovery/status` 确认 `configured` 为 `true`，此状态只证明已填写配置，最终模型调用仍需在应用中验证。

## 3. 先跑 iPhone 模拟器

在终端 B：

```bash
cd ~/Projects/Jarvis/app
npm ci
EXPO_PUBLIC_API_BASE=http://127.0.0.1:9301 npx expo run:ios --device
```

在设备选择列表里选一个 iPhone 模拟器。Expo 会生成 `ios/`、安装原生依赖、编译应用并启动开发服务；首次编译需要等待。模拟器通过 `127.0.0.1` 访问 Mac 的后端。

已有的 `npm run ios` 实际是 `expo start --ios`，它打开 Expo Go 预览。本指南使用 `expo run:ios` 编译当前项目的原生应用。无需另外执行 `expo start`，构建命令已启动服务。原生工程由 Expo 生成，不需要从 Windows 复制。

## 4. 连接真正的 iPhone

1. 用 USB 把 iPhone 接到 Mac，解锁并点“信任此电脑”。
2. 让两台设备连接同一个可相互访问的 Wi-Fi。使用访客网络时可能被隔离。
3. iPhone → 设置 → 隐私与安全性 → 开发者模式，按提示开启、重启并确认。首次配对前可能没有这个选项；先在 Xcode 的设备管理窗口完成配对。
4. Xcode → Settings → Accounts 登录你的 Apple ID。首次个人测试可先尝试 Personal Team；可用能力和有效期取决于 Apple 签名限制，TestFlight 分发需要另外准备开发者计划。
5. 在 Mac 系统设置 → Wi-Fi → 当前网络详情 → TCP/IP 查看 IP；Wi-Fi 常用的查询命令是：

```bash
ipconfig getifaddr en0
```

如果没有输出，以系统设置中显示的 IP 为准。下面以 `192.168.1.20` 举例，必须换成你实际的 Mac IP。

6. 保持后端运行，先在 iPhone 的 Safari 打开 `http://192.168.1.20:9301/health`。看到 JSON 后，再启动应用；打不开时先检查 IP、同一网络和 Mac 防火墙是否允许 Node 的入站连接。
7. 停掉之前终端 B 的开发服务，重新运行：

```bash
cd ~/Projects/Jarvis/app
EXPO_PUBLIC_API_BASE=http://192.168.1.20:9301 npx expo run:ios --device
```

选择连接的 iPhone。真机上的 `localhost` 指向手机本身，所以这里必须使用 Mac IP。USB 用于安装与调试，应用仍需通过网络访问后端和开发服务。

若签名失败，打开生成的 `app/ios/*.xcworkspace`，在应用 Target → Signing & Capabilities 开启 Automatically manage signing，选择你的 Team。默认 Bundle Identifier 为 `com.jarvis.secretary`；如果提示冲突，把 `app.json` 中 `expo.ios.bundleIdentifier` 改为你唯一的标识，再用 `npx expo prebuild --platform ios` 同步并构建。个人团队的签名设置可能需要在重新生成工程后再选一次。

首次运行允许“本地网络”访问；本版已添加用途说明和局域网访问配置。若之前拒绝，到 iPhone 设置 → 隐私与安全性 → 本地网络为应用打开。HTTP 局域网地址用于本地测试，公开部署时换成 HTTPS 后端。

## 5. 用这些场景检查体验

| 操作 | 预期行为 |
| --- | --- |
| 打开首页 | 下栏收起；问候区域约占 40%；小点横排；保留哲理句 |
| 缓慢上滑，再中途松手 | 毛玻璃面板跟手移动，松手后自然吸附；下拉可收起 |
| 输入文字、打开和收起键盘 | 球回应输入；输入框始终可操作；键盘不挡发送按钮 |
| 问“这个月只剩800元，帮我规划预算” | 在首页预算模式回答 |
| 问“不是睡眠问题，我想解释代码” | 留在首页，不进入睡眠 |
| 说“今天很累” | 先澄清意图，不直接跳转 |
| 说“最近晚上睡不着，想调整睡前安排” | 理解后进入睡眠，带上已有会话和回复 |
| 发送消息 | 立即有等待反馈，实际内容到达后平滑展开，完整验证后再显示卡片 |
| 点停止或返回 | 中断生成，用户消息保留，可重试 |
| 生成时向上看历史 | 不把阅读位置强行拉到底部 |
| 在睡眠里切换“体验示例” | 显示清楚的模拟数据标识和早晨/傍晚/晚间示例 |
| iPhone 开启“减少动态效果” | 关闭装饰性的呼吸、旋转与弹簧进入 |
| 设一个几分钟后的提醒，再锁屏 | 明确时间并确认后检查系统通知；取消后确认不再出现 |

建议录一段从首屏、上滑、打字到收到回复的视频，连同 iPhone 型号、iOS 版本和发生问题的操作发回来。记录“发送到第一段文字”和“发送到结束”两个时间，动画顺滑程度与模型等待时间分开观察。

HealthKit 和 Apple Calendar 尚未接入原生读取，安装到 iPhone 不会自动增加这两项能力。本地通知、键盘避让、原生毛玻璃和触觉反馈仍需这次真机验证。

## 6. 后续日常启动

首次装好以后，只修改 JS/TS 页面通常不必重新编译：保持后端运行，终端 B 执行：

```bash
cd ~/Projects/Jarvis/app
EXPO_PUBLIC_API_BASE=http://192.168.1.20:9301 npx expo start --lan
```

然后打开已安装的测试应用。模拟器使用 `127.0.0.1`。新增原生依赖或修改 iOS 权限时重新构建。若更改了 `app.json` 中的原生配置，先运行 `npx expo prebuild --platform ios` 再构建；不要用 `--clean` 随意删除已配置的签名工程。

若仍显示旧后端地址，停止开发服务并用相同环境变量运行 `npx expo start --lan --clear`。Mac IP 变化时也要更新地址并重启。Expo 的 tunnel 只处理开发资源连接，不会把 `9301` 后端一起暴露出去。

## 官方参考

- Expo 本地编译：https://docs.expo.dev/guides/local-app-development/
- Expo iOS 环境配置：https://docs.expo.dev/get-started/set-up-your-environment/
- Apple 局域网用途说明：https://developer.apple.com/documentation/bundleresources/information-property-list/nslocalnetworkusagedescription
- Apple 局域网传输配置：https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking
