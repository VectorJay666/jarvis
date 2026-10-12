# 随身助手 · 三角色 Skill 提纲（v0.1）

> Skills · 2026-10-11 · 对齐一页纸 v0.1 + Backend `/v1/council` 提案契约  
> 范围：健身教练 / 饮食顾问 / 作息恢复 — 触发、边界、负向用例。日程/专注占位不写深。

提案输出形状（与 Backend §3 一致）：
`role` · `action` · `duration_min` · `veto[]` · `confidence` · `tags[]`

---

## 1. 健身教练 `fitness`

### 触发
- 用户选中健身教练，或会商需要训练段
- 入参齐：`free_minutes`、`fatigue`/`sleep_hours`
- Demo 钩子：`free_minutes=40` 且需给出可完成短训

### 步骤（Skill 内）
1. 读疲劳与可用时间；`sleep_hours<6` 或 `fatigue=high` → 只出 low_impact / 拉伸，不硬推计划表
2. 估 `duration_min` ≤ `free_minutes`（预留恢复管家拉伸余量）
3. 写一条口语可照做的 `action`（含动作类型与分钟）
4. 若恢复侧可能否决加练，预先 `veto` 空或自降；证据不足 `confidence≤0.4`

### 边界（可做）
- 改强度、改时长、改成低冲击/居家无器械方案
- 标签：`low_impact` / `strength` / `cardio_light` 等

### 负向（必须拒 / Backend 会丢弃）
| ID | 输入/行为 | 期望 |
|---|---|---|
| F-N1 | 输出含伤病诊疗、药方、康复处方 | 拒；不进卡 |
| F-N2 | `sleep_hours=5` 仍给 HIIT/重负力训 | 拒或自降；recovery 否决生效 |
| F-N3 | `duration_min > free_minutes` | 裁时或拒 |
| F-N4 | 承诺「一周练出腹肌」类结果 | 拒 |
| F-N5 | 证据不足仍 `confidence>0.4` 且高强度 | 强制 ≤0.4 + 保守动作 |

### 成功标准
- Demo：40 分钟窗口 → 短训动作可在余量内完成；可被 recovery 否决降级
- 每条 `action` 可单手照做，无器械依赖默认成立

---

## 2. 饮食顾问 `diet`

### 触发
- 会商需要下一餐建议；或用户选中饮食顾问
- 入参齐：`fridge[]`；可选下一餐窗口

### 步骤
1. 只从 `fridge` 取材；缺材不发明「外卖三文鱼」
2. 结合训练日/短训后补：蛋白优先但用语口语
3. `duration_min` 可为 0（做饭时间可写进 action 文本）
4. 食材不够 → `confidence` 降 + 降级方案（如蛋炒饭+蛋白表述）

### 边界（可做）
- 基于现有食材的一餐组合、份量口语化（「一碗」「两个蛋」）
- 标签：`protein` / `simple_cook` / `post_workout`

### 负向
| ID | 输入/行为 | 期望 |
|---|---|---|
| D-N1 | 用到 fridge 外食材 | 拒或重提案；Backend 食材否决 |
| D-N2 | 极端节食 / 只喝代餐清肠 | 拒 |
| D-N3 | 减重数字承诺（「一周掉 X 斤」） | 拒 |
| D-N4 | 医疗营养处方（糖尿病食谱诊疗） | 拒 |
| D-N5 | fridge 空仍高置信给出大餐 | `confidence≤0.4` + 保守/提示补货 |

### 成功标准
- Demo：fridge=`egg,rice` → 蛋炒饭类可执行方案；不出现清单外食材

---

## 3. 作息/恢复管家 `recovery`

### 触发
- 会商必参与（安全角色）；或用户选中恢复管家
- 入参：`sleep_hours` / `fatigue` / `free_minutes`

### 步骤
1. 算恢复优先级：睡眠债 → 否决加练权
2. `sleep_hours<6` 或 `fatigue=high` → 对 `fitness` 发出 `veto`（reason 写清）
3. 钉 `sleep_window` 与训练后拉伸；保入睡窗口优先于加练
4. 时间不够时裁健身时长，不裁入睡窗口

### 边界（可做）
- 拉伸、降温、入睡窗口、次日减量建议
- 标签：`sleep_window` / `mobility` / `deload`

### 负向
| ID | 输入/行为 | 期望 |
|---|---|---|
| R-N1 | 给出失眠药方 / 褪黑素剂量诊疗 | 拒 |
| R-N2 | 睡眠债下不对 fitness 否决、默许 HIIT | FAIL（安全否决未触发） |
| R-N3 | 入睡窗口与 `free_minutes` 冲突时仍塞满训练 | 优先保 sleep_window |
| R-N4 | 承诺「睡满就涨肌肉」类结果 | 拒 |
| R-N5 | 证据不足却取消否决 | 否决规则仍生效（确定性） |

### 成功标准
- Demo：睡 5h → 否决高强度；卡片含拉伸 + 入睡窗口；`vetoes_applied` 可见

---

## 4. 会商级负向（跨角色）

| ID | 场景 | 期望 |
|---|---|---|
| C-N1 | 三角色各说各话、无否决、三张卡 | 对外只一张卡；必须有 handoffs |
| C-N2 | 聊天流多轮替代交接班卡 | 拒（产品形态） |
| C-N3 | 日程/专注参与首期投票 | 忽略；仅占位 |
| C-N4 | SILENT_FAIL：丢掉否决却不写 `vetoes_applied` | FAIL |
| C-N5 | 医疗/减重话术混进任一 handoff | 整段丢弃或遮罩 |

---

## 5. Demo 钩子黄金期望（给 Test 对齐）

输入：`sleep_hours=5` · `free_minutes=40` · `fridge=["egg","rice"]`

| 角色 | 期望动作方向 |
|---|---|
| fitness | 低冲击短训或拉伸向，时长可放入 40min 余量 |
| diet | 蛋+米可完成的简餐 |
| recovery | 否决加练 + 钉入睡窗口 + 训后拉伸 |

卡片：三条短签交接，非聊天流；可见至少一条 `vetoes_applied`（recovery→fitness）。

---

## 6. 交付与下一步

- 本文件：`/workspace/jarvis/03-Skills提纲-三角色.md`【已交】
- 下一步（等 Backend `/v1/council` 桩）：把三角色提案落成可调用函数/规则表，与仲裁联调
- 不做：医疗诊断、减重承诺、实时体征告警、日程/专注深 Skill
