# 架构说明 / Architecture

[English](../en/dev/ARCHITECTURE.md) · [使用指南](../user/USAGE.md)

## 1. 一句话架构

> 构建期把六个 JS 模块拼成**一个共享作用域的 IIFE**，内嵌进单 HTML；运行时在浏览器内完成 JWPUB → ZIP → SQLite → 解密 → DOM → IndexedDB 的全链路，所有数据留在本机。

```text
src/index.template.html
  ├── src/styles.css
  ├── src/categories.json  → window.__CATEGORY_CONFIG__
  ├── src/vendor/{jszip,pako,sql-wasm}.js
  └── src/modules/00..05  ──拼接──▶ 单个 <script> IIFE
                                      │
                                      ▼
                      offline_library.html（单文件产物）
                                      │
         JWPUB 导入 → ZIP → SQLite → 解密 → 清洗 → IndexedDB → 阅读器/笔记/备份
```

## 2. 模块职责

| 文件 | 主要职责 |
|---|---|
| `00-core-db.js` | 全局状态、版本常量、i18n、诊断 API、加密解密、HTML 清洗、IndexedDB 打开与书籍持久化/迁移 |
| `01-importer-security.js` | ZIP 魔数校验、损坏 ZIP 重建、JWPUB/SQLite 解析、文档解码与导入容错 |
| `02-publication-catalog.js` | 分类规则、卡片渲染、栏目首页、自定义分类、笔记编辑器 |
| `03-reader-links.js` | 阅读器、搜索、高亮、脚注/串珠、`jwpub://` 链接路由 |
| `04-navigation-history.js` | 导入对话框、导航、返回栈、侧栏、翻页、事件绑定、语言包输入 |
| `05-backup-startup.js` | 备份/恢复、Blob 打包、启动流程、设置与关于 |

这六个文件**不是 ES Module**。它们被顺序拼进同一个 `<script>`，共享顶层变量与函数（见 `00-core-db.js` 开头的全局状态与结尾处 `05-backup-startup.js` 的启动 IIFE）。因此模块顺序由 `project.json` 的 `modules.order` 决定，不能随意调整。

## 3. 启动流程

`05-backup-startup.js` 末尾：

```text
applyI18n()
  → openDB()
  → ensureMigrated()
  → ensureCategoryIds()
  → renderBooks()
```

失败时弹出「本地存储不可用」。数据库名与版本来自 `project.json`：`OfflineJwLibrary` v5。

## 4. 数据层

### 4.1 Store

`openDB()` 创建 12 个 object store：

| Store | 用途 |
|---|---|
| `books` | 轻量书籍元数据索引 |
| `bookMeta` | 书籍元数据（含 generation） |
| `bookDocs` | 文档正文 |
| `bookAssets` | 图片/字体/资源 |
| `bookAux` | 辅助数据、导入报告 |
| `notes` | 笔记 |
| `bookmarks` | 书签 |
| `history` | 阅读历史 |
| `system` | 迁移标记、规范锚点缓存等 |
| `bookMeta` / `categories` | 分类 |
| `tags` | 标签 |
| `highlights` | 高亮 |

> 分类实际位于 `categories` store；上表中的重复项仅表示它在 UI/元数据中都有体现。
>
> 可选的原始包保存在独立数据库 `OfflineJwLibrarySources` 的 `sources` store，不改变主库版本；测试 2.0 后 1.0.0 仍能打开现有图书馆。

### 4.1b 2.0 实验读取路径

`sourceReadEnabled()` 开启后，`showDoc()` 调用 `sourceDocHtml()`：从 `OfflineJwLibrarySources` 取出原始 JWPUB，解出内层 ZIP 和 SQLite，按 `DocumentId` 查询并解密当前文档；圣经章节由 `sourceBibleChapterHtml()` 查询 `BibleChapter` / `BibleVerse`；失败时回退到 `bookDocs` / `bibleData` 的解析数据。`sourceDbCache` / `sourceDocCache` 做 LRU，`pagehide` 时 `closeSourceDbs()` 释放。

`sourceFirstEnabled()` 开启后，导入成功并保存原始包后调用 `stripBookDocHtml()`、`stripBookAuxHtml()`、`stripBibleContent()` 和 `stripAssets()`：普通正文、摘录/研究注释/每日经文 HTML 置空，圣经 `verseRows/chapterRows` 的密文和 key/iv 清空，`bookAssets` 图片/字体记录删除，只保留目录、索引和结构；`showDoc()`、`ensureDocHtml()`、`loadAssetsForHtml()`（经 `sourceAssetBlob()`）、搜索、聚会、链接预览、注释浮窗、每日经文和圣经章节/范围内经文都按需从原始包读取。旧书不受影响；诊断面板的「按原始包清理现有书」可对已有原始包的旧书手动执行同一清理。

### 4.1c 应用锁与加密层

可选应用锁使用 PBKDF2-SHA256（310k 次）从密码派生 KEK，并用 AES-GCM 包裹随机 DEK；恢复码独立派生 KEK，包裹同一 DEK。锁元数据同时保存在 `localStorage` 和 `system` 的 `lockMeta`，任一存在即可在启动时恢复锁界面。启用锁时先要求所有书都有原始包并执行 `stripAllSourceBooks()`，随后 `encryptExistingSources()` 加密源包、`sealExistingUserData()` 加密用户数据字段；之后 `saveBookSource()`/`getBookSource()` 和 `saveOne()`/`getOne()`/`getAllUser()` 自动加解密。备份使用 `.olvault` 整文件加密；恢复时用头部 `lock` 解出 DEK。原始 JWPUB 包内容不修改，导出前解密回原始字节。

### 4.2 元数据 + 分表 + generation

- `buildBookMeta()` 生成轻量元数据；
- `persistBook()` 把文档、资源、辅助数据拆到不同 store；
- `loadBook()` 按 `gen` 重组整本书；
- 再次导入同一本书成功提交后，`purgeOldGenerations()` 删除旧 `gen` 数据。

这样可以在导入失败时保留旧版本，同时避免无限堆积历史资源。

### 4.3 稳定 ID

旧 ID 形如 `lang_symbol_year[_issue]`，同一出版物换年份会导致笔记错位。当前用 `legacyIdFor()` / `keySymbolFor()` / `idFor()` 生成稳定 ID，并在恢复旧备份时用 `buildRestoreIdMap()` + `remapUserDataIds()` 重映射笔记、高亮、书签与历史 ID。

规范锚点 `ensureCanonicalAnchors()` 为跨语言高亮提供定位依据；恢复后通过删除缓存并重建来刷新。

## 5. 导入链路

1. `fileToBytes()` 读取文件；`zipHasEocd()` / `zipHasLocalHeader()` 校验；必要时 `rebuildZipFromLocalHeaders()` 修复缺失 central directory 的 ZIP。
2. JSZip 打开 archive，读取 `manifest.json`，处理可能的 `contents` 内层 ZIP。
3. sql-wasm 读取 SQLite，解析 `Document`、`BibleVerse`、`Hyperlink`、`Extract`、`Commentary`、`DatedText` 等表。
4. `keyIv()` 由 `lang_symbol_year[issue]` 派生 key/iv，`decryptContentAny()` 依次尝试 `aes+zlib`、`aes+raw`、`plain+zlib`、`plain+raw`、`plain-text`。
5. 生成目录、`bibleStructure`、按日期的每日经文文档，抽取图片/字体等资源。
6. `persistBook()` 写入 IndexedDB，并生成导入报告。

保护阈值（见 `01-importer-security.js` 顶部）：单文件 ≤ 380 MB、内部文件 ≤ 8000、单文档 ≤ 48 MB、失败率上限 0.6。

## 6. 阅读与安全边界

### 6.1 阅读器状态与界面

- 题头统一为返回按钮、两行标题（出版物名 + 当前章节/文章）和三个点菜单；目录、搜索、上一章/下一章、书签、笔记、语言版本、拼音、字号都在菜单内，旧底部操作栏已移除。
- `sectionViews` 与 `sectionPageHistory` 保存在 IndexedDB `system` store 的 `readerPanelCache` 记录中，按栏目隔离；启动时先 `loadReaderCache()` 再渲染，并恢复上次所在栏目与段落。
- 相关链接浮窗的题头可点击，通过 `openPublicationDocument()` 打开目标文章段落；`openDocInBook()` 会把当前文章压入当前栏目的返回历史。
- 浮窗内的离线警告使用 `#modal`，层级高于链接浮窗；关闭警告不会触发浮窗的 outside-click 关闭。
- 笔记边栏铅笔标记、选中经文/段落的整块高亮由 CSS 实现；点击已上色文字时 `showHighlightOutline()` 按视觉行合并为一个绝对定位圆角框。
- 阅读器搜索范围由 `readerSearchScope` 控制：`publication` / `category` / `selected` / `all`。`searchScopeMetas()` 按 `categoryPath()` 和 `BOOK_CATEGORIES` 顺序排序后逐本遍历；`renderReaderSearchHits()` 按 `groupKey` 分组，每组默认显示 5 条，其余折叠。所选出版物 ID 保存在 `localStorage` 的 `offlineLibrarySearchSelectedBooks`。

`cleanHtml()`（`00-core-db.js`）是正文进入 DOM 前的主要清洗器：

- 移除 `script`、`iframe`、`object`、`embed`、`base`、`meta[http-equiv]`、远程 `<link>` 与远程图片；
- 把 `video` / `audio` 换成离线提示；
- 删除 `on*` 事件属性、`srcdoc`、`javascript:` URL；
- 重写内联 CSS 的 `url()`，远程地址改为 `none`；
- `jwpub://...` 转成 `data.jwlink`，外链转成 `data.externalLink`；
- 未映射资源移除 `src` / `href`。

`cleanHtml()` 目前是**黑名单模型**，且源码中仍有大量 `innerHTML`。已知需要优先修复的面：`03-reader-links.js` 中 `titleRich` / `subtitleRich` 直接插入 `innerHTML`，以及高亮颜色插入 `style` 属性。修复计划见 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) P0。

## 7. 诊断 API

`window.__offlineLibrary` 暴露：

| 成员 | 说明 |
|---|---|
| `version` | 应用版本 |
| `cryptoMode` | `webcrypto` 或 `js-fallback` |
| `diagnostics()` | 版本、存储用量、出版物摘要、导入报告、最近事件 |
| `cleanOldGenerations()` | 清理旧 generation |
| `pinyinDebug()` | 注音调试信息 |
| `registerLanguagePack()` | 注册语言包 |
| `setUiLanguage()` | 切换界面语言 |
| `events()` | 最近诊断事件 |

这是诊断接口，**不是插件 API**，也没有权限模型、事件订阅或沙箱。插件规划见 [PLUGINS.md](PLUGINS.md)。

## 8. 明确不做的事

- 没有服务端、账号或同步；
- 没有 Service Worker / PWA 缓存；
- 没有业务 `fetch` / XHR / WebSocket；
- 没有运行时插件加载；
- 不保存音视频，只显示离线提示；
- 不验证 JWPUB 来源/签名；密钥派生用于格式兼容，不是机密性保护。
