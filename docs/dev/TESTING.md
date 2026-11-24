# 测试与验证 / Testing

[English](../en/dev/TESTING.md) · [架构说明](ARCHITECTURE.md)

## 1. 当前状态

目前仓库**没有自动化测试框架**（无 `package.json`、无 test 脚本）。现有 [`验证记录.md`](../../验证记录.md) 是一次性的 0.4.0 时期记录，不能替代可重复测试。建立测试体系是开发计划 P1 的重点。

## 2. 已有验证（来自历史记录）

- 拼接后的模块通过 `node --check`；
- 模板中没有未替换的占位符；
- Chromium 中栏目导航可用；
- 真实样本 `g_CHS_202611.jwpub`、`S-401_CHS.jwpub` 导入成功；
- 打开《警醒！》文章、图片、目录与桌面布局通过；
- 测试环境未观察到失败的外部请求。

尚未验证：Windows PowerShell 构建、Sitecase 真机、`jwpub://c/` 链接、复杂杂志排版、字体、多媒体、低内存设备。

## 3. 测试矩阵

| 层级 | 环境 | 必测内容 |
|---|---|---|
| 静态 | Node.js | `node --check` 拼接产物；占位符扫描；`project.json` 与文档版本一致性 |
| 构建 | Windows PowerShell + Node | 两种构建产物一致；`build.ps1` 生成 rollback |
| 桌面浏览器 | Chromium（主）、Firefox/Safari（兼容性） | 五栏目、导入、阅读、搜索、标注、备份/恢复 |
| 移动端 | iPhone Sitecase 真机 | 导入本地 HTML、IndexedDB 持久化、文件选择、内存、图片布局 |
| 安全 | 恶意样本 | XSS、远程资源、外链、损坏 ZIP、超大文件 |

## 4. 样本清单

至少准备：

- 圣经 JWPUB（含 `BibleVerse`）；
- 书籍 JWPUB；
- 杂志 JWPUB（复杂版式、图片、字体）；
- 每日经文 JWPUB（含 `DatedText`）；
- 聚会工作手册；
- 含 `ParagraphCommentary` / `VerseCommentary` 且带 `jwpub://c/` 链接的出版物；
- 多语言出版物（验证跨语言笔记/高亮）；
- 损坏 ZIP（缺 central directory）、空文件、超大文件。

## 5. 关键回归用例

### 导入

1. 单文件 / 批量导入；
2. 重复导入同一出版物，确认选择覆盖后笔记保留；
3. 部分文档解码失败时，其余文档仍可读；
4. 导入失败时旧 generation 仍可用；
5. 导入报告内容正确。

### 阅读

1. 目录跳转、返回栈、搜索结果返回；
2. `jwpub://p/`、`jwpub://b/`、`jwpub://c/` 本地路由；
3. 未匹配链接显示原因且不联网；
4. 外链点击被拦截；
5. 远程图片/CSS 不产生网络请求；
6. 桌面三栏与手机全屏切换。

### 数据

1. 稳定 ID 跨年份/语言不漂移；
2. 高亮在恢复后仍对准原文；
3. 笔记撤销/重做；
4. 备份 → 清空 → 恢复后数据一致；
5. 历史备份 v1/v2/v3 兼容恢复；
6. 大备份流式恢复不崩溃。

### 安全

1. 正文 `<script>`、`onerror`、`javascript:` URL 被清除；
2. 远程 `<img>` / `<link>` / CSS `url()` 被剥离；
3. `titleRich` / `subtitleRich` 注入测试（当前已知风险，见 P0）；
4. 高亮颜色样式注入测试；
5. 损坏 ZIP 不导致无限循环或崩溃。

## 6. 验收标准

- 构建产物可离线打开并完成端到端导入→阅读→标注→备份→恢复；
- 测试环境网络面板中无业务请求；
- 桌面与 Sitecase 真机各完成一轮完整流程；
- 所有已知 P0 安全问题有回归用例并通过；
- 版本号、CHANGELOG、README、发布产物一致。

## 7. 建议的下一步

先在 `tests/` 下建立可运行的最小套件：

1. `tests/build-check.mjs`：占位符、版本、`node --check`、产物哈希；
2. `tests/sanitizer.spec.*`：用 jsdom/happy-dom 验证 `cleanHtml()`；
3. `tests/backup-format.spec.*`：验证打包/解包与 ID 重映射（纯函数可 Node 运行）；
4. 浏览器端到端脚本（Playwright）留到 P1 后期引入。

详见 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)。
