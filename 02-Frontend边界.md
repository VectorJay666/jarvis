# 随身助手 · Frontend 边界（v0.1）

> Frontend · 2026-10-11 · 对齐一页纸 v0.1、Backend `02-后端骨架-会商建议习惯.md`、Skills `03-Skills提纲-三角色.md`

## 1. 栈选型（已定）

- **React Native + Expo**（managed）+ TypeScript  
- 交付目标：**iOS App**（App Store / TestFlight 方向）  
- 盒子：Expo Web 预览 + 静态 export；**签名/真机在用户 Mac + Apple Developer**  
- 未选 Flutter：Expo Web 便于盒子验收截图；团队 RN 路径更短

工程：`/workspace/jarvis/app/`

## 2. 场景契约（一屏竖屏）

单手竖屏、无页间导航、无横屏。同一 ScrollView 内三步：

1. **选角色**（5 个都可选；日程/专注标「二期」，选中后提示「三角色会商代班」）  
2. **三格状态**：`sleep_hours` / `free_minutes` / `fridge[]`  
3. **一张交接班建议卡**：`headline` + 三条 `handoffs` 短签 + 可选 `sleep_window` / `vetoes_applied`；**不是聊天流**

不做医疗诊断、减重承诺文案；disclaimer 固定展示 Backend 回传句。

## 3. 客户端契约（与 Backend 对齐）

### 基址

- 环境变量：`EXPO_PUBLIC_API_BASE`（盒子联调默认 `http://127.0.0.1:9301`，见 `server/council.mjs`）  
- **禁止** 9101/9102（ICT 冻结端口）  
- 未配置 → `USE_MOCK=true`，走 `src/mock/buildHandoffCard.ts`（形状同下，不发起网络）  
- 已配置 → `src/api/council.ts` → `POST {base}/v1/council`；失败抛错由 UI 展示，不静默吞掉

### 请求 `POST /v1/council`（Backend §2）

```json
{
  "sleep_hours": 5,
  "free_minutes": 40,
  "fridge": ["egg", "rice"],
  "active_role": "fitness"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `sleep_hours` | number | 昨晚睡眠小时 |
| `free_minutes` | int | 今晚可用分钟 |
| `fridge` | string[] | 食材 id，Demo=`egg`,`rice` |
| `active_role` | enum | `fitness\|diet\|recovery\|schedule\|focus`；只影响 `lead_role` 语气，不关掉另外两角 |
| `fatigue` | optional | FE 首期不传；Backend 可由 sleep 推导 |

### 响应卡（Backend §4）

```json
{
  "card_id": "string",
  "lead_role": "fitness|diet|recovery",
  "headline": "string",
  "handoffs": [
    { "role": "fitness", "action": "低冲击短训 …" },
    { "role": "diet", "action": "一碗蛋炒饭+蛋白 …" },
    { "role": "recovery", "action": "拉伸 + 入睡窗口 …" }
  ],
  "sleep_window": "22:30-23:00",
  "vetoes_applied": [
    { "from": "recovery", "to": "fitness", "reason": "昨晚只睡 5 小时…" }
  ],
  "disclaimer": "非医疗建议；不承诺减重效果"
}
```

FE 展示时把 `role` 映射为中文短签（`label`）；若 Backend 附带 `label` 亦可直接用。  
`schedule` / `focus` **不得**出现在 `handoffs`（Skills 占位不进会商投票）。

### 反馈（首期 UI 未做）

`POST /v1/feedback` `{ card_id, rating, note? }` —— 二期再接。

## 4. 与 Skills 的接缝

FE **不**调用单角色 Skill；只消费仲裁后的一张卡。  
负向（诊疗/减重承诺/高强度睡债）由 Skills+Backend 丢弃；FE 只渲染卡上已有字段，不二次生成建议文案。

## 5. 本轮范围 / 不做

**做：** 五角色选择、状态编辑、会商 CTA、mock/API 卡渲染、iOS HIG 浅色竖屏。  
**不做：** 真签名、习惯回写 UI、聊天流、横屏、多页路由、ICT/openJiuwen、医疗/减重文案。

## 6. 预览与截图

```bash
cd /workspace/jarvis/app && npm run web
# 或 npx expo export --platform web
```

截图：`/workspace/jarvis/shots/`（01-roles / 02-status / 03-handoff-card）
