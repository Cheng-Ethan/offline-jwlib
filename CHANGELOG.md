# 更新记录 / Changelog

> 当前版本以 `project.json` 为准：**0.14.0**。0.5–0.13 的条目根据应用内 `APP_UPDATE_NOTES` 补全，详细任务见 [开发计划](docs/dev/DEVELOPMENT_PLAN.md)。

## 未发布（0.14.0 之后）
- **统一阅读器界面**：题头只保留返回、两行标题（出版物名 + 当前章节/文章）和三个点菜单；目录、搜索、上一节/下一节、书签、笔记、语言版本、拼音、字号全部收纳到该菜单，移除底部操作栏。
- 每个栏目的当前文章、返回历史和精确段落位置持久化到本机数据库；重新打开 HTML 或导入出版物后继续原栏目、原段落。
- 相关链接浮窗以链接名称为题头，点击即可直达目标文章段落并计入当前栏目返回历史；浮窗内的警告置于最上层并带关闭按钮，关闭警告不影响主浮窗。
- 段落/经文信息面板显示脚注正文，以及串珠/相关经文的章节名和正文；不再重复列出「整节经文 相关经文」区块；外部链接提示离线不可用。
- 笔记边栏标记改为铅笔符号；点中经文/段落使用更明显的蓝色整块高亮；点击已上色文字时按整行合并为一个圆角边框。
- 高亮颜色按钮改为四个同尺寸、不透明圆片从左到右层叠，黄色在最前并完整露出，绿、蓝、红依次在右侧露出弧形；点开显示四个大圆点；信息、笔记、复制图标统一为更饱满的 1:1 比例。每日经文分页文案为前一日/后一日。
- 每日经文、多媒体图书馆和聚会阅读器不再显示底部操作栏。
- 出版物里的「你会怎么回答？」等回答框默认只占一行高度，输入变多时自动向下长高。

## 0.14.0（2026-11-24）
- **界面一致性改版**：统一 9 档字号、4 档圆角、2 种阴影与语义色 token；按钮、图标按钮、菜单项和确认框共用同一套组件规则。
- 界面图标统一为一套线性 SVG；分类图标不再使用 emoji；书签使用同一星形图标的空心/实心状态。
- 顶部「更多」菜单收敛为 4 个顶层项；备份与恢复、设置与诊断进入二级菜单；新增「使用说明」入口。
- 高亮颜色收进一个颜色按钮的浮层；恢复「本章笔记」入口；上一节/下一节按位置禁用，并支持左右方向键翻页。
- 浏览器原生 `confirm()` 改为可翻译的应用内确认对话框；补齐英语、日语、韩语界面文案。
- 无障碍：统一焦点环、Escape 关闭浮层、弹窗焦点管理、44px 触控目标、减少动效支持；界面允许缩放。

## 0.13.0（2026-11-24）
- **基线版本**：本仓库以 0.13.0 作为初始版本，上游更早历史折叠；本次文档分层重构不升版本。开发规则见 [AGENTS.md](AGENTS.md)。
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

The current version is defined by `project.json`: **0.14.0**. Entries for 0.5–0.13 were reconstructed from the in-app `APP_UPDATE_NOTES`.

- **Unreleased** — unified reader header (back, two-line publication/chapter title, three-dot menu) with table of contents, search, paging, bookmark, notes, language version, pronunciation and font size inside the menu; per-tab article, back history and exact paragraph position persisted across reloads and imports; navigable link-preview titles that open the target paragraph and join the tab history; warnings above link popovers with their own close button; footnotes and cross-references with resolved text in paragraph/verse info; pencil note markers; clear blue block highlight for the active verse/paragraph and one merged outline per highlighted line; a four-disc colour button with yellow front and green, blue and pink arcs layered behind it, opening four large colour discs; fuller 1:1 information, note and copy icons; previous/next-day labels for the daily text. Answer fields in publications are one line tall by default and grow as more text is typed.
- **0.14.0** — UI consistency pass: shared type/radius/shadow/semantic-colour tokens; one linear SVG icon set; four-item More menu with nested backup and settings views; in-app help; one highlight-colour control; restored chapter-notes entry; pager states and arrow-key paging; in-app translatable confirmations; focus management, Escape handling, 44px touch targets and reduced-motion support.
- **0.13.0** — baseline version (earlier upstream history collapsed; this docs restructure does not bump it; see [AGENTS.md](AGENTS.md)); full-text search for Bible/publications, recent searches, return-to-results; bilingual open-source documentation split into user/dev trees; MIT licence, contributing guide, security policy, code of conduct and third-party notices.
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

