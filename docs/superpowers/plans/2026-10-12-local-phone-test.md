# 局域网手机测试实施计划

> **For agentic workers:** 在当前会话执行；保留现有工作区修改，不创建子代理。

**Goal:** 无付费会员、无云服务器、无额外账号登录时，用当前 Windows 电脑为同 Wi-Fi iPhone 提供页面和真实 AI 服务。

**Architecture:** 8081 Expo Web + 9301 Jarvis 后端；客户端后端地址使用电脑 LAN IP。当前 Mac 版本未知，先提供浏览器测试，原生测试等待确认 macOS/Xcode 可用性。

**Tech Stack:** PowerShell、Node.js 24、Expo SDK 57、Safari。

**Spec:** 用户要求使用本机/旧 Mac 做服务器，工作室电脑可能不能登录个人账户。

## Global Constraints

- 不追加账号登录、购买、公开隧道或路由器端口映射。
- 不把网页测试称作 iOS 原生安装或 TestFlight。
- 不修改防火墙和网络分类；先检查已存在的入站规则。
- 只重启本工作区的 Expo 服务，保留已运行的 Jarvis 后端。

### 1. LAN 启动

**Files:** `scripts/start-local.ps1`；日志仅写入忽略的 review-artifacts。

- [x] 查询 Wi-Fi IP 192.168.1.219，确认现有 Node 入站允许规则与可执行路径匹配。
- [x] 检查 8081 页面与 9301 后端已有监听，后端 configured=true。
- [x] 脚本启动通过，LAN 后端 /health 返回成功；390x844 Chromium 页面发送真实消息，通过 9301 的 assistant/stream 收到完整模型回复；无页面错误。结果保存在 review-artifacts/local-phone-results.json。

### 2. 用户操作指南

**Files:** `docs/local-phone-testing.md`。

- [x] 已写入 docs/local-phone-testing.md。
- [x] 已更新原部署计划，TestFlight 暂缓，无原生签名产物。
- [ ] 用户在 iPhone 上实际打开并确认；macOS 版本仍需用户提供。
