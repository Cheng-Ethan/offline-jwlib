# 更新记录 / Changelog

> 当前版本以 `project.json` 为准：**0.13.0**。0.5–0.13 的条目根据应用内 `APP_UPDATE_NOTES` 补全，详细任务见 [开发计划](docs/DEVELOPMENT_PLAN.md)。

## 0.13.0（2026-11-24）
- 圣经、出版物全文搜索；最近搜索与“返回结果”。
- 补齐中英双语开源文档：README、安装、使用、架构、插件、备份格式、测试、发布与开发计划。
- 新增 MIT 许可证、贡献指南、安全策略、行为准则与第三方声明。

## 0.12.0
- 圣经串珠、经文信息、单节复制与经文笔记。

## 0.11.0
- 可收起笔记编辑器、撤销/重做、栏目位置恢复。

## 0.10.0
- 稳定分类 ID、自定义分类与分类管理。

## 0.9.0
- 界面语言与内容语言分离、语言版本切换、跨语言笔记。

## 0.8.0
- 个人研读栏目、标签、高亮笔记、稳定 ID 与流式备份恢复。

## 0.7.0
- 多语言界面、拼音、滑动翻页与聚会周切换。

## 0.6.0
- 五栏目导航、首页每日经文与圣经分步浏览。

## 0.5.0
- 拆分存储、解析容错、诊断与自动测试。

## 0.4.0（2026-11-16）
- 增加独立的圣经、出版物、每日经文、聚会、更多栏目首页。
- 增加桌面端三栏阅读工作区：左侧主导航、中间目录、右侧正文；移动端保留全屏阅读。
- 增加圣经、杂志、书籍、聚会资料、每日经文等阅读样式模板。
- 更多页面集中管理导入、备份、最近阅读、书签和个人笔记。
- 解析并保存 JWPUB 中的 ParagraphCommentary / VerseCommentary 数据；对 jwpub://c/ 链接执行本地匹配，匹配不到时给出明确原因。
- 保持 IndexedDB 数据库名称和现有 store 不变，增加持久化存储申请（浏览器支持时）。

## 0.3.0（2026-11-16）
- 模块化源码与 Windows 一键构建。
- 批量导入、原始 SQLite 保存、出版物删除、文件名显示。
- 图片资源缓存与多种资源引用解析。
- 注音开关、阅读历史、滚动位置记录。
- v2 完整二进制备份与 v1 兼容恢复。

说明：Sitecase 跨项目 IndexedDB 持久性、复杂 JWPUB 内部链接变体及真机图片布局仍需目标设备验证。

---

## English summary

The current version is defined by `project.json`: **0.13.0**. Entries for 0.5–0.13 were reconstructed from the in-app `APP_UPDATE_NOTES`.

- **0.13.0** — full-text search for Bible/publications, recent searches, return-to-results; bilingual open-source documentation (README, install, usage, architecture, plugins, backup format, testing, release, development plan); MIT licence, contributing guide, security policy, code of conduct and third-party notices.
- **0.12.0** — Bible concordance, verse info, single-verse copy and verse notes.
- **0.11.0** — collapsible note editor, undo/redo and section scroll restoration.
- **0.10.0** — stable category IDs, custom categories and category management.
- **0.9.0** — separated UI/content languages, language-version switching and cross-language notes.
- **0.8.0** — personal study section, tags, highlights, stable IDs and streaming backup/restore.
- **0.7.0** — multilingual UI, pronunciation, swipe page turning and meeting-week switching.
- **0.6.0** — five-section navigation, home daily text and stepwise Bible browsing.
- **0.5.0** — split storage, parser tolerance, diagnostics and automated checks.
- **0.4.0** — desktop three-pane reading, reading templates and commentary support.
- **0.3.0** — modular sources, batch import, reading history and backups.

