# Claude Code 主流程学习地图（可回主线）

> 目标：你可以随时钻细节，但永远知道自己在主流程的哪个节点。
>
> 用法：每次提问时带上“节点编号”（如 `N3`），回答完就回到 `N1 -> N8` 主链继续。

---

## 0. 总览（先记住这条主链）

`N1 用户输入` -> `N2 输入预处理` -> `N3 构建上下文与提示词` -> `N4 调用模型(流式)` -> `N5 解析 tool_use` -> `N6 权限判定与工具执行` -> `N7 tool_result 回流` -> `N8 结束或下一轮`

把它当成 Java 后端里的：
- Controller (`N1-N2`)
- Service orchestration (`N3-N5`)
- Executor + policy (`N6`)
- Event loop with state transition (`N7-N8`)

---

## N1 用户输入进入系统

### 你看到的现象
- 在 REPL 输入一句话，或者在 SDK/pipe 模式传入 prompt。

### 对应代码
- `src/screens/REPL.tsx`（交互入口）
- `src/utils/handlePromptSubmit.ts`（提交和排队）

### 这一层做什么
- 处理空输入/退出命令
- 在并发中决定“立即执行还是入队”
- 把输入交给统一处理管线

### 常见疑问
- 为什么有时不会立刻执行而是排队？
- 为什么同一时刻只跑一个主查询？

---

## N2 输入预处理（统一入口）

### 对应代码
- `src/utils/processUserInput/processUserInput.ts`
- `src/utils/processUserInput/processTextPrompt.ts`

### 这一层做什么
- 识别模式：普通 prompt / slash 命令 / bash / 图片
- 生成标准化消息 `UserMessage`
- 挂载附件上下文（比如 IDE 选区、图片、内存等）

### 常见疑问
- slash 命令和普通 prompt 为什么走同一入口？
- 图片是怎么被塞进消息的？

---

## N3 构建上下文与系统提示词

### 对应代码
- `src/utils/queryContext.ts`（组装入口）
- `src/constants/prompts.ts`（`getSystemPrompt`）
- `src/utils/systemPrompt.ts`（`buildEffectiveSystemPrompt`）
- `src/context.ts`（`getUserContext` / `getSystemContext`）

### 这一层做什么
- 生成 system prompt（静态 + 动态 section）
- 注入 `CLAUDE.md`、git 快照、日期等上下文
- 按模式选择 prompt（default/custom/agent/coordinator）

### 常见疑问
- 提示词为什么不是一个大字符串？
- 为什么要做 dynamic boundary 和缓存分层？

---

## N4 调用模型（流式）

### 对应代码
- `src/query.ts`（主循环 `query/queryLoop`）
- `src/services/api/claude.ts`（实际 API 流）

### 这一层做什么
- 把 messages + system prompt + tools 发给模型
- 流式接收 assistant 输出事件
- 同步处理可恢复错误（如 token 超限恢复）

### 常见疑问
- 为什么是 `AsyncGenerator`，不是简单 async 函数？
- 流式事件和最终消息是什么关系？

---

## N5 解析 tool_use

### 对应代码
- `src/query.ts`（收集 `tool_use` block）

### 这一层做什么
- 从 assistant 输出里提取工具调用请求
- 判断是否进入“工具轮次”
- 准备执行队列（可并发/需串行）

### 常见疑问
- 一个回复里多个工具调用怎么调度？
- 为什么有些工具会并行，有些必须串行？

---

## N6 权限判定与工具执行（真正改变世界）

### 对应代码
- `src/hooks/useCanUseTool.tsx`（allow/deny/ask）
- `src/services/tools/toolExecution.ts`（`runToolUse`）
- `src/services/tools/StreamingToolExecutor.ts`（并发执行器）
- `packages/builtin-tools/src/tools/BashTool/BashTool.tsx`（命令落地执行）

### 这一层做什么
- 输入校验（zod schema）
- 权限判定（规则/分类器/交互确认）
- 实际执行：读写文件、跑 shell、调用 MCP

### 常见疑问
- “创建前端项目”到底在哪一步真的创建了目录和文件？
- 工具报错后为什么有时会自动恢复、有时不会？

---

## N7 tool_result 回流模型

### 对应代码
- `src/services/tools/toolExecution.ts`
- `src/query.ts`

### 这一层做什么
- 把工具输出包装成 `tool_result`
- 追加回消息历史
- 再喂给模型决定下一步

### 常见疑问
- 为什么模型会继续下一步而不是结束？
- tool_result 太大时如何处理（截断/落盘）？

---

## N8 结束或下一轮

### 对应代码
- `src/query.ts`（循环终止条件）
- `src/QueryEngine.ts`（结果归档、会话持久化）

### 这一层做什么
- 若无新工具调用则完成回答
- 若有则继续下一轮
- 记录 transcript、统计 usage、支持 resume

### 常见疑问
- 会话如何恢复到中断前状态？
- 什么情况下会强制中止（max turns / abort / stop hook）？

---

## 调试走读路径（第一次建议）

### 最小断点链
1. `src/utils/processUserInput/processTextPrompt.ts`
2. `src/query.ts`（进入 `queryLoop`）
3. `src/services/tools/toolExecution.ts`（`runToolUse`）
4. `packages/builtin-tools/src/tools/BashTool/BashTool.tsx`（`call`）

### 你应该观察到
- N2 形成了 `UserMessage`
- N4 收到 assistant 的 `tool_use`
- N6 真正执行命令（比如 `npm create vite...`）
- N7 生成 `tool_result` 并触发下一轮

---

## 提问模板（保证可回主线）

你提问时可以用下面格式，我会按这个回答并把结论补回文档：

- `N3 问题：为什么 memory section 要缓存？`
- `N6 问题：BashTool 的权限拒绝后具体返回什么 message？`
- `N4/N5 问题：流式输出何时判定需要 follow-up？`

---

## 学习进度（由我们共同维护）

- [x] 主流程地图建立
- [ ] N1-N2 细读完成
- [ ] N3 细读完成
- [ ] N4-N5 细读完成
- [ ] N6 细读完成
- [ ] N7-N8 细读完成

