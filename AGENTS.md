# AGENTS.md — 本仓库开发规则（唯一规则源）

所有会话、agent 和贡献者在动手前必须先读本文件。若与其他文档冲突，**以本文件为准**。

> English summary follows the Chinese rules.

## 1. 基线

- 初始基线版本：**0.13.0**；上游 0.13 之前的历史视为折叠，不再追溯。当前版本以 `project.json` 的 `appVersion` 为准。
- 文档分层重构属于 0.13 基线的一部分；从 0.14 起按第 4 节规则升版本并重建产物。

## 2. 分支规则

| 分支 | 角色 |
|---|---|
| `develop` | 日常开发流。所有功能、修复、文档改动先提交到这里 |
| `master` | 发布流。由用户定期按需从 `develop` push/merge；agent 不直接 push `master` |
| `main` | 通过 API 导入快照时留下的上游历史引用，仅作参考；不再从它切分支 |

- 功能分支从 `develop` 切出，完成后合回 `develop`。
- 禁止 force push 到任何共享分支。
- 本地 `git commit` 不需要网络；仓库设为私有后只有远端操作需要凭证。

## 3. 文档受众规则

| 目录 | 受众 | 内容 |
|---|---|---|
| `docs/user/` | 普通用户 | 安装到设备、使用、移动端、FAQ。不出现 IndexedDB、IIFE、sanitizer、构建占位符等术语 |
| `docs/dev/` | 开发者/维护者 | 构建、架构、插件、备份格式、测试、发布、开发计划、规则 |
| `docs/en/user/` / `docs/en/dev/` | 英文读者 | 与中文目录一一对应 |

新增或修改文档时：

1. 先判断受众，放进对应目录；
2. 中英双语同步；
3. 更新 README 的两张文档表；
4. 跑本地 Markdown 链接校验，确保 0 失效；
5. 每次新增或改变用户可见行为，必须同步更新 `CHANGELOG.md`、对应的用户/开发文档及英文镜像，不能只改代码。

`README_使用说明.md`、`验证记录.md`、`rollback/README_回滚说明.md` 是历史文档，只保留指针，不作为规则来源。

## 4. 版本规则

| 变更类型 | 版本动作 | 例子 |
|---|---|---|
| 破坏性变更：备份格式、模块 API、数据结构或插件 API 不兼容 | 升 major：`x.0.0` | 备份格式 v2、模块顺序改变 |
| 新功能 / 新用户可见能力 / 新扩展点 / 新平台支持 | 升 minor：`0.x.0` | 新增搜索、语言包 v1、Android 正式支持 |
| 非破坏性的文档或构建改进，不新增用户功能 | 升 patch：`0.x.y` | 文档重构、构建加固、依赖台账 |
| 纯 bug 修复 | **不升版本** | 修 XSS、修导入失败、修错字 |

版本号唯一源头是 `project.json` 的 `appVersion`。升版时必须同步：

1. `project.json`
2. `src/modules/00-core-db.js` 的版本常量
3. `CHANGELOG.md`
4. `README.md` / `README.en.md`
5. HTML meta 由构建注入，不手改产物

如果只是 bug 修复，仍然提交到 `develop`，但不改任何版本号，也不重建发布产物。

## 5. 扩展点命名

- 用户自定义语言 JSON 正式称为 **用户语言包（插件 v0 / 数据型扩展）**。
- 它只能替换界面语言字符串；不能注册代码、钩子、权限，不能访问出版物数据。
- 当前**没有代码插件系统**。不要把它描述成完整插件 API。
- 用户文档写“怎么用”，开发者文档写 `registerLanguagePack()` 与持久化 key。

## 6. 安全规则

- 不提交真实 JWPUB 样本、个人备份、Token 或密钥。
- 发现漏洞走 `SECURITY.md`，不要在公开 issue 放可利用细节。
- 导入的 JWPUB 是不可信输入；修改清洗/解析/恢复逻辑必须补验证。
- 应用不发起业务网络请求；新改动不得引入外部脚本、遥测或服务端依赖。

## 7. 提交约定

- 格式：`type: 简短描述`，例如 `fix: sanitize rich titles before innerHTML`。
- 一次提交只做一件事。
- 提交信息用中文或英文均可，但要说清“为什么”。
- 当前工作成果先提交到 `develop`；是否发布由用户决定。

## 8. 会话连续性

如果新 session 被创建（换方向、旧 session 删除等）：

1. 先读本文件；
2. 再读 `README.md` 与 `docs/dev/DEVELOPMENT_RULES.md`；
3. 不要重新询问本文件已回答的版本、分支、文档归属规则；
4. 只就本文件未覆盖、且会改变实现方向的问题提问。

---

## English summary

- Initial baseline is **0.13.0**; the current version is `appVersion` in `project.json`.
- `develop` is the development stream; `master` is published periodically by the user; `main` is only an upstream reference.
- User docs live in `docs/user/`; developer docs in `docs/dev/`; both have English mirrors. Every user-visible change must update `CHANGELOG.md` and the relevant docs in both languages.
- Version rules: major for breaking changes, minor for new capabilities, patch for non-breaking improvements, **no bump for pure bug fixes**. `project.json` → version constant → CHANGELOG → READMEs must stay in sync.
- Language JSON is **user language pack (plugin v0)** — a data-only extension, not a code plugin API.
- Never commit personal JWPUB samples/backups or secrets. Report vulnerabilities privately per `SECURITY.md`.
- Commit to `develop`; never force-push; agents do not push `master`.
