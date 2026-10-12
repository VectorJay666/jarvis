# Jarvis council stub

- **Port:** `9301`（`PORT` / `HOST` 可改）
- **Start:** `node /workspace/jarvis/server/council.mjs`
- **Health:** `GET /health`

## Endpoints

| Method | Path | Body |
|---|---|---|
| POST | `/v1/council` | `{ sleep_hours, free_minutes, fridge[], fatigue?, active_role? }` |
| POST | `/v1/feedback` | `{ card_id, rating?, note? }` → 204 |
| GET | `/v1/habit` | — |

CORS: `*`（方便 Expo Web）。

## Expo Web 联调

盒子上 Expo Web 预览用：

```
EXPO_PUBLIC_API_BASE=http://127.0.0.1:9301
```

真机请换成 Mac/局域网可达地址（盒子 localhost 真机打不开）。

## Demo 钩子自测

```bash
curl -s http://127.0.0.1:9301/v1/council -H 'content-type: application/json' \
  -d '{"sleep_hours":5,"free_minutes":40,"fridge":["egg","rice"],"active_role":"fitness"}'
```

期望：一张卡、`handoffs` 三角色、`vetoes_applied` 含 recovery→fitness、饮食为蛋炒饭、有 `sleep_window`。
