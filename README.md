# 随身助手 Jarvis

Expo 客户端与 Node 后端。首页提供健康入口，睡眠与恢复模式 使用「简短回复 + 随对话更新的计划卡 + 便捷回复 + 可展开依据」。当前包含明确标识的交互演示，以及可配置的真实模型接口。

## 本地启动（PowerShell）

在仓库根目录启动后端：

    node server/council.mjs

另开终端启动前端：

    cd app
    npm ci
    $env:EXPO_PUBLIC_API_BASE = 'http://127.0.0.1:9301'
    npm run web -- --port 8081

浏览器打开 http://localhost:8081。首页「看睡眠」或健康图标 → 健康详情 → 睡眠与恢复。演示包含早晨、傍晚、晚上的示例，返回和刷新可保留本机会话。

macOS / Linux 的前端命令：

    cd app
    npm ci
    EXPO_PUBLIC_API_BASE=http://127.0.0.1:9301 npm run web -- --port 8081

## Mac / iPhone 原生测试

按 [Mac 测试指南](docs/mac-testing.md) 配置 Xcode、启动后端并运行 `npx expo run:ios --device`。模拟器使用 `127.0.0.1`，真机使用 Mac 的局域网 IP。从仓库拉取最新代码后按指南安装依赖。

TestFlight 分发见 [TestFlight 指南](docs/testflight.md)，需开发者账号和在线 HTTPS 后端。

## 真实模型

仅使用演示不需要模型密钥。启用真实对话时，将 server/.env.example 复制为 server/.env，填写 DEEPSEEK_API_KEY，并核对账户支持的模型和服务地址，再重启后端。密钥只留在后端。

GET /v1/recovery/status 返回配置状态。首页通过 POST /v1/assistant/stream 理解意图并流式回答，明确的睡眠问题才转入睡眠。POST /v1/recovery/stream 流式生成睡眠回复，完整输出校验后再展示卡片；POST /v1/recovery/talk 保留为兼容接口。未配置或失败会明确显示错误，保留消息供重试。

HealthKit 和 Apple Calendar 尚未接入原生读取；演示数据有标签，手动记录的缺失字段不会由演示数值补齐。原生通知需要明确时间和用户确认，成功后取得通知 ID，可以取消；尚需 iPhone 实测，Web 预览不发送系统通知。

真机预览须将 EXPO_PUBLIC_API_BASE 换成手机可访问的局域网地址。生产构建时也需要设置部署后的 API 地址。

## 检查

仓库根目录：

    node --test server/recovery.test.mjs server/stream.test.mjs app/tests/recovery.test.cjs

app 目录：

    npm exec tsc -- --noEmit
    npm run lint
    npm run export

## 目录

| 目录 | 说明 |
| --- | --- |
| app/ | Expo SDK 57、React Native 客户端 |
| app/src/recovery/ | 睡眠对话、演示、接口客户端与共享证据目录 |
| server/ | Node 服务，默认端口 9301 |
| skills/sleep-recovery/ | 睡眠与恢复的模型决策与表达规则 |
| docs/recovery-review.md | 原版反馈、迁移内容与验证边界 |

首页支持季节插画、常驻语音水球、玻璃输入面板和快捷选项；跟进、习惯、我的及详情页统一使用逐项浮现动效。录音面板支持录制与试听，语音转写尚未接通，原生录音仍需真机验证。其他页仍含旧团队与会商功能。非医疗诊断工具。

详见 [运行与迁移反馈](docs/recovery-review.md)、[客户端说明](app/README.md) 和 [后端说明](server/README.md)。

## License

见 [app/LICENSE](app/LICENSE)。
