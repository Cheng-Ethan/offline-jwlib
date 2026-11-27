# 开发规则（人类可读版）/ Development rules

[English](../en/dev/DEVELOPMENT_RULES.md) · [规则唯一源头：AGENTS.md](../../AGENTS.md)

本文件是给人看的速查版。**机器和 agent 以仓库根目录的 [`AGENTS.md`](../../AGENTS.md) 为准**；两者冲突时以 AGENTS.md 为准。

## 当前基线

- 版本：`2.0.0`（初始基线为 0.13.0）
- 开发分支：`develop`
- 发布分支：`master`（由用户定期发布，agent 不直接 push）
- `main`：上游导入快照的历史引用，不再使用

## 版本速查

| 改动 | 版本号 |
|---|---|
| 破坏性变更（备份格式、模块 API、数据结构） | `x.0.0` |
| 新功能 / 新能力 / 新扩展点 / 新平台支持 | `0.x.0` |
| 非破坏性文档或构建改进 | `0.x.y` |
| 纯 bug 修复 | **不变** |

升版时同步：`project.json` → `src/modules/00-core-db.js` 版本常量 → `CHANGELOG.md` → `README.md` / `README.en.md`。HTML meta 由构建注入。

## 文档归属

- 用户：`docs/user/`（安装、使用、移动端、FAQ）
- 开发者：`docs/dev/`（构建、架构、插件、备份、测试、发布、计划、规则）
- 英文：`docs/en/user/`、`docs/en/dev/`

用户文档不要写开发者术语。每次改文档都要中英同步并更新 README 表格。每次新增或改变用户可见行为，必须同时更新 `CHANGELOG.md`、对应的用户/开发文档及英文镜像。

## 语言包 = 插件 v0

用户自定义语言 JSON 是**数据型扩展（插件 v0）**：只能换界面语言，不能运行代码或访问数据。完整代码插件系统尚未实现。

## 提交

- 先提交到 `develop`，不直接 push `master`；
- `type: 简短描述`，一次提交一件事；
- 不提交个人 JWPUB、备份、Token；
- 安全问题走 `SECURITY.md`。
