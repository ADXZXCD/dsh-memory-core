# dsh-memory-core

便携式 DSH 分层记忆核心库，负责“路由、审计、候选校验”，不负责直接替用户写入记忆，也不负责创建项目或发布代码。

仓库地址：<https://github.com/ADXZXCD/dsh-memory-core>

## 解决什么问题

DSH 记忆通常分为 Runtime Memory、Topic、Workspace Memory、Skill 和长期归档。内容如果没有清晰边界，容易出现：

- 触发词过短导致错误路由；
- 索引指向不存在的 Topic；
- 私有凭据被普通查询暴露；
- 同层 Topic 或 Skill 触发词冲突；
- 用户纠正直接被固化成错误流程。

本库提供确定性的 Node.js 能力，供 DSH Skill、定时任务和宿主适配器调用。

## 功能

### 记忆路由

- 解析 `memory-index.md`。
- 使用 `/` 分隔多个触发词。
- 拒绝过短查询和过短拉丁缩写的模糊命中。
- 普通查询不展示 `private/` 路径。
- 明确凭据意图时只返回私有定位，不预览正文。
- 合并全局和项目层指向同一文件的重复命中。

### 记忆审计

- 检查索引文件是否存在。
- 检查索引目标是否存在且没有越出记忆根目录。
- 检查触发词分隔符。
- 检查同层触发词重叠。
- 检查 Topic 的状态和作用域元数据。
- 检查 Skill frontmatter、重复名称和重复内容。

### 技能进化候选

候选流程是只暂存、不自动升级：

```text
任务事件
  → 脱敏候选
  → 查重和范围检查
  → memory-guard
  → 用户确认
  → 写入全局 Topic 或 Skill
  → 回归验证
```

候选默认只能进入全局范围。项目专属内容不由核心库生成项目 Topic。

## 安装

要求 Node.js 20 或更高版本。

```bash
npm install dsh-memory-core
```

也可以直接克隆仓库运行：

```bash
git clone https://github.com/ADXZXCD/dsh-memory-core.git
cd dsh-memory-core
npm test
npm run check
```

## 命令行用法

### 路由查询

```bash
node ./bin/dsh-memory.mjs route "自定义路由" --home "$DSH_MEMORY_HOME"
```

### 严格审计

```bash
node ./bin/dsh-memory.mjs audit \
  --home "$DSH_MEMORY_HOME" \
  --project /path/to/workspace \
  --strict
```

### 记录全局技能候选

```bash
node ./bin/dsh-memory-evolution.mjs capture \
  --skill github-plugin-publish \
  --kind lesson \
  --summary "发布前先核查实际写入通道" \
  --lesson "分别确认绑定状态、写入工具、凭据通道和远端复核" \
  --evidence "不含秘密的任务证据" \
  --source "项目任务"
```

### 审查候选

```bash
DSH_MEMORY_HOME="$DSH_MEMORY_HOME" \
node ./bin/dsh-memory-evolution.mjs audit --strict

DSH_MEMORY_HOME="$DSH_MEMORY_HOME" \
node ./bin/dsh-memory-evolution.mjs question
```

候选目录由 `DSH_SKILL_EVOLUTION_DIR` 指定；未指定时使用 `$DSH_MEMORY_HOME/skill-evolution/`。

## 候选分类

| 类型 | 目标 | 例子 |
| --- | --- | --- |
| `memory` | 全局 Runtime Memory 或全局 Topic | 跨项目稳定的环境事实 |
| `lesson` | 技能专属全局 Topic | 可复用的故障防范教训 |
| `skill` | 全局 `SKILL.md` 候选 | 已验证的重复操作流程 |
| `conflict` | 保持待审 | 两条规则互相矛盾 |

当前核心库强制候选范围为 `global`。当前任务授权、密码、Token、项目临时配置和未经验证的猜测不能成为正式候选。

## 数据安全

核心库不会：

- 读取或打印凭据内容；
- 自动修改 Runtime Memory、Topic 或 Skill；
- 自动创建项目 Topic；
- 自动创建定时任务；
- 自动推送 GitHub；
- 把完整会话转录写入候选。

敏感内容过滤是防线，不是凭据管理器。正式部署仍需使用宿主的私有凭据存储。

## 与其他仓库的关系

- [`dsh-memory-skills`](https://github.com/ADXZXCD/dsh-memory-skills)：流程规则。
- [`dsh-memory-adapters`](https://github.com/ADXZXCD/dsh-memory-adapters)：DSH、Provider 和定时任务适配。
- [`dsh-github-publish`](https://github.com/ADXZXCD/dsh-github-publish)：发布前安全门禁。

## 开发与验证

```bash
npm run check
npm test
npm pack --dry-run
```

当前版本：`0.2.0`。该版本属于早期兼容版本，宿主集成应自行验证 DSH 版本、Workspace 绑定方式和 Provider 能力。
