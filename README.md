# offline-jwlib · 我的私人图书馆

[English](README.en.md) · [简体中文](README.md)

> 离线、单文件、本地优先的 JWPUB 阅读器。打开一个 HTML，导入 `.jwpub` / `.pub`，在浏览器内完成解压、解密、解析、阅读与笔记，不需要服务器，也不会主动联网。

当前版本：**0.13.0**（以 [`project.json`](project.json) 为准）。

---

## 这是什么

`offline-jwlib` 把模块化源码在构建期内嵌进一个独立的 `offline_library.html`。这个 HTML 可以被：

- 在桌面浏览器中直接打开；
- 导入 iPhone 的 Sitecase 等支持本地 HTML 的容器；
- 作为离线资料库长期保存。

数据（出版物、图片、笔记、书签、高亮、标签、历史）保存在浏览器的 IndexedDB / localStorage 中。应用本身不发起业务网络请求，外部链接与远程资源会被拦截或剥离。

## 主要功能

- **导入**：批量导入 JWPUB，支持 ZIP 修复、解码模式回退、失败隔离与导入报告。
- **五个栏目**：圣经、出版物、每日经文、聚会、更多。
- **阅读器**：目录、搜索、内部链接跳转、脚注/串珠、字号、注音、翻页、桌面三栏布局。
- **个人研读**：笔记、标签、高亮、书签、阅读历史，使用稳定 ID 跨语言/跨年份保留。
- **备份**：完整图书馆备份、笔记备份，支持历史备份格式兼容与流式恢复。
- **定制**：分类规则 `src/categories.json`、语言包导入、界面语言与内容语言分离。

## 快速开始

### 使用者

1. 取一份 `offline_library.html`（发布产物或自行构建）。
2. 桌面浏览器直接打开，或导入 Sitecase。
3. 点击「导入 PUB」，选择一个或多个 `.jwpub` / `.pub`。
4. 从栏目首页打开出版物开始阅读。

### 开发者构建

Windows 用户：

```bat
build.bat
```

跨平台（需要 Node.js，无需 `npm install`）：

```bash
node build.mjs
```

构建会读取 [`project.json`](project.json)，把 `src/` 下的模块、样式、分类规则和 `src/vendor/` 内嵌进 `src/index.template.html`，并输出：

- `offline_library.html`
- `dist/offline_library.html`

> `build.ps1` 会在覆盖前把旧 HTML 备份到 `rollback/`；`build.mjs` 目前不会自动回滚。详见 [安装与构建](docs/INSTALL.md)。

## 文档

| 文档 | 说明 |
|---|---|
| [安装与构建](docs/INSTALL.md) | 环境、构建、产物、回滚、发布校验 |
| [使用指南](docs/USAGE.md) | 导入、阅读、标注、备份、常见问题操作 |
| [架构说明](docs/ARCHITECTURE.md) | 模块、数据流、IndexedDB、安全边界 |
| [插件与扩展](docs/PLUGINS.md) | 现有扩展点、语言包、分类规则、插件系统规划 |
| [备份格式](docs/BACKUP_FORMAT.md) | 备份 JSON 格式、二进制打包、ID 映射 |
| [测试与验证](docs/TESTING.md) | 测试矩阵、样本、真机验证清单 |
| [开发计划](docs/DEVELOPMENT_PLAN.md) | P0–P3 路线图与下一步任务 |
| [贡献指南](CONTRIBUTING.md) | 开发流程、提交规范、PR 检查单 |
| [安全策略](SECURITY.md) | 漏洞报告与隐私说明 |
| [行为准则](CODE_OF_CONDUCT.md) | 社区参与约定 |
| [第三方声明](THIRD_PARTY_NOTICES.md) | 内嵌依赖及许可证 |
| [更新记录](CHANGELOG.md) | 版本变更历史 |
| [English docs](docs/en/) | 英文文档目录 |

旧的 [`README_使用说明.md`](README_使用说明.md) 与 [`验证记录.md`](验证记录.md) 是 0.4.0 时期的历史文档，保留作参考；请以本目录文档为准。

## 隐私与安全

- 所有解析与存储在本地完成；没有账号、遥测或业务网络请求。
- 笔记、标签、高亮和历史以明文保存在本机 IndexedDB；导出的备份 JSON 也未加密。请不要在共享设备上导出含敏感内容的备份。
- 应用会剥离远程图片/CSS 并拦截外链，但导入的 JWPUB 仍属于不可信输入。发现安全问题请按 [SECURITY.md](SECURITY.md) 报告。

## 许可证

[MIT](LICENSE) © 2026 Cheng-Ethan。内嵌第三方依赖的许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
