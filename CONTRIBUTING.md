# 贡献指南 / Contributing

[English](#english) · [简体中文](#简体中文)

> 本文件不定义规则。动手前请先读 [AGENTS.md](AGENTS.md)——它是分支、版本、文档归属和提交约定的唯一规则源。

## 简体中文

感谢你考虑参与 `offline-jwlib`。项目坚持本地优先、单文件、离线可用，任何改动都不应引入服务端依赖或业务网络请求。

### 开发环境

- 源码阅读：任意编辑器；
- 构建：Windows 用 `build.bat`，其他平台用 `node build.mjs`；
- 不需要 `npm install`，当前没有 npm 依赖；
- 阅读 [ARCHITECTURE.md](docs/dev/ARCHITECTURE.md) 和 [PLUGINS.md](docs/dev/PLUGINS.md) 再动手。

### 分支与提交

- 规则以 [AGENTS.md](AGENTS.md) 为准；
- 从 `develop` 切出功能分支：`git checkout -b feature/xxx`，完成后合回 `develop`；
- `master` 由用户定期发布，不要直接 push；
- 提交信息建议：`type: 简短描述`，例如 `fix: sanitize rich titles before innerHTML`；
- 一个提交只做一件事；不要提交个人 JWPUB 样本或备份。

### 改动要求

1. 涉及解析/清洗/恢复逻辑，必须补测试或至少手工验证样本；
2. 改版本号时同步 `project.json`、`CHANGELOG.md`、`README.md`；
3. 改 `project.json` 模块顺序或备份格式，必须提升相应版本并更新文档；
4. 保持单文件产物无外部依赖；
5. 安全修复优先，不要在公共 issue 中放置可利用细节，走 [SECURITY.md](SECURITY.md)。

### PR 检查单

- [ ] 描述问题、方案与影响范围；
- [ ] 本地构建成功，产物可离线打开；
- [ ] `node --check` 与占位符检查通过；
- [ ] 相关文档同步更新（中英双语）；
- [ ] 不引入业务网络请求；
- [ ] 通过 [TESTING.md](docs/dev/TESTING.md) 的相关用例。

### 文档

新增功能必须同时更新中文和英文文档，并放入正确受众目录。目录结构：

```text
README.md / README.en.md
docs/user/*.md         中文用户文档
docs/en/user/*.md      英文用户文档
docs/dev/*.md          中文开发者文档
docs/en/dev/*.md       英文开发者文档
```

---

## English

Thanks for considering a contribution to `offline-jwlib`. The project is local-first, single-file and offline-capable. Changes must not introduce a server dependency or business network requests.

### Development setup

- Any editor for source reading;
- Build with `build.bat` on Windows or `node build.mjs` elsewhere;
- No `npm install` — there are currently no npm dependencies;
- Read [ARCHITECTURE.md](docs/en/dev/ARCHITECTURE.md) and [PLUGINS.md](docs/en/dev/PLUGINS.md) first.

### Branches and commits

- Rules are defined in [AGENTS.md](AGENTS.md);
- Branch from `develop`: `git checkout -b feature/xxx`, merge back into `develop`;
- `master` is published periodically by the user; do not push it directly;
- Prefer `type: short description`, e.g. `fix: sanitize rich titles before innerHTML`;
- Keep commits focused; never commit personal JWPUB samples or backups.

### Change requirements

1. Parser/sanitiser/restore changes need tests or at least documented manual sample verification;
2. Version changes must sync `project.json`, `CHANGELOG.md` and `README.md`;
3. Module order or backup format changes require a version bump and doc update;
4. Keep the single-file artifact free of external dependencies;
5. Security fixes go through [SECURITY.md](SECURITY.md), not public issues with exploit details.

### PR checklist

- [ ] Describe the problem, approach and impact;
- [ ] Local build succeeds and the artifact opens offline;
- [ ] `node --check` and placeholder checks pass;
- [ ] Chinese and English docs updated;
- [ ] No business network requests introduced;
- [ ] Relevant [TESTING.md](docs/en/dev/TESTING.md) cases pass.

### Documentation

Every feature must update both Chinese and English docs in the correct audience directory:

```text
README.md / README.en.md
docs/user/*.md         Chinese user docs
docs/en/user/*.md      English user docs
docs/dev/*.md          Chinese developer docs
docs/en/dev/*.md       English developer docs
```
