# offline-jwlib · 我的私人图书馆

[English](README.en.md) · [简体中文](README.md)

> 离线、单文件、本地优先的 JWPUB 阅读器。打开一个 HTML，导入 `.jwpub` / `.pub`，在浏览器内解压、解密、解析、阅读和记笔记；不需要服务器，也不主动联网。

当前版本：**2.0.1**（初始基线 0.13.0，见 [AGENTS.md](AGENTS.md)）。

---

## 我是用户

你不需要 Node.js、npm 或联网，只需要一个 `offline_library.html` 文件。

| 文档 | 你会学到 |
|---|---|
| [安装到设备](docs/user/INSTALL.md) | 桌面打开、iPhone/iPad 导入、升级前备份 |
| [使用指南](docs/user/USAGE.md) | 导入、阅读、搜索、笔记、备份恢复、语言包 |
| [移动端说明](docs/user/MOBILE.md) | iPhone 的 Sitecase 步骤；安卓的本地服务/WebView 方案 |
| [常见问题](docs/user/FAQ.md) | 数据存在哪、升级后书不见了、外链打不开等 |

快速开始：打开 `offline_library.html` → 点「导入 PUB」→ 选择 `.jwpub` / `.pub` → 从栏目首页阅读。**升级前一定先导出完整备份。**

## 我是开发者 / 维护者

动手前请先读 [AGENTS.md](AGENTS.md)：它定义了分支、版本、文档归属和提交规则，是所有 session 的唯一规则源。

| 文档 | 内容 |
|---|---|
| [开发规则速查](docs/dev/DEVELOPMENT_RULES.md) | 人类可读的版本/分支/文档规则 |
| [构建与产物](docs/dev/BUILD.md) | 构建脚本、占位符、产物、回滚、私有仓库 Git |
| [架构说明](docs/dev/ARCHITECTURE.md) | 模块、数据流、IndexedDB、安全边界 |
| [插件与扩展](docs/dev/PLUGINS.md) | 扩展点、语言包（插件 v0）、插件系统规划 |
| [备份格式](docs/dev/BACKUP_FORMAT.md) | JSON 格式、二进制打包、ID 重映射 |
| [测试与验证](docs/dev/TESTING.md) | 测试矩阵、样本、验收标准 |
| [发布流程](docs/dev/RELEASING.md) | 版本号、发布检查单、校验和 |
| [开发计划](docs/dev/DEVELOPMENT_PLAN.md) | P0–P3 路线图与下一步 |
| [设计文档归档](docs/superpowers/specs/) | 历次设计决策 |

补充文档：[贡献指南](CONTRIBUTING.md) · [安全策略](SECURITY.md) · [行为准则](CODE_OF_CONDUCT.md) · [第三方声明](THIRD_PARTY_NOTICES.md) · [更新记录](CHANGELOG.md)

## 重要约定

- 初始基线 `0.13.0`；当前版本以 `project.json` 为准。
- 开发提交先进 `develop`；`master` 由用户定期发布，agent 不直接 push。
- 用户自定义语言 JSON 称为**用户语言包（插件 v0）**：只能换界面语言，不是代码插件系统。
- 数据只留在本机 IndexedDB / localStorage；备份 JSON 未加密。
- 旧文档 [`README_使用说明.md`](README_使用说明.md)、[`验证记录.md`](验证记录.md)、[`rollback/README_回滚说明.md`](rollback/README_回滚说明.md) 仅作历史参考。

## 许可证

[MIT](LICENSE) © 2026 Cheng-Ethan。内嵌依赖见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
