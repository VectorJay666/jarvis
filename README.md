# 随身助手 Jarvis

单 Agent 健康首页：主动读共享健康数据 → 判断是否需要调整 → 打开 App 时按习惯排出按钮式功能。简洁黑白 UI，Expo + DeepSeek。

| 目录 | 说明 |
|---|---|
| [`app/`](./app/) | React Native + Expo（SDK 57）iOS 竖屏客户端 |
| [`server/`](./server/) | Node stub，默认端口 `9301`（`/v1/home`、`/v1/talk`、`/v1/nudge`…） |
| [`skills/`](./skills/) | 规则引擎（home / nudge / boss / follow / fitness…） |
| `01`–`08` `*.md` | 产品与 Frontend / Backend 契约文档 |

## 快速开始

```bash
# 1. Backend（需先复制环境变量）
cp server/.env.example server/.env   # 填入 DEEPSEEK_API_KEY
node server/council.mjs

# 2. Expo
cd app && npm install
EXPO_PUBLIC_API_BASE=http://127.0.0.1:9301 npm run web
```

真机请把 `EXPO_PUBLIC_API_BASE` 换成局域网可达地址。详见 [`app/README.md`](./app/README.md)、[`server/README.md`](./server/README.md)。

## 当前方向（单 Agent）

- 打开即见时段问候 + 可选主动提醒（nudge）
- 习惯排序的按钮式功能（≤3），玻璃跟手交互
- 点进功能后走原有对话 / 跟进流；非医疗建议

## 不做

医疗诊断、减重承诺、多 Agent 会商主界面、把密钥提交进仓库。

## License

见 [`app/LICENSE`](./app/LICENSE)。
