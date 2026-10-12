# Skills · 三角色规则表（v0.1）

可调用提案层，供 Backend `/v1/council` 引用。仲裁仍在 `server/council.mjs`。

```
skills/rules/
  fitness.mjs    proposeFitness
  diet.mjs       proposeDiet
  recovery.mjs   proposeRecovery
  forbidden.mjs  banned / sanitize
  index.mjs      proposeAll
  selfcheck.mjs  Demo 钩子 + 负向冒烟
```

自检：`node /workspace/jarvis/skills/rules/selfcheck.mjs`

提纲：`/workspace/jarvis/03-Skills提纲-三角色.md`
