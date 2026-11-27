# 离线图书馆模块化项目 0.4.0

> ⚠️ 这是 0.4.0 时期的历史文档，保留作参考。当前代码为 **2.1.0**，请以 [README.md](README.md)、[使用指南](docs/user/USAGE.md) 和 [移动端说明](docs/user/MOBILE.md) 为准。

## 构建
1. 解压项目文件夹。
2. 双击 `build.bat`。
3. 根目录生成 `offline_library.html`。
4. 导入 iPhone Sitecase 或直接在桌面浏览器打开。

无需安装 Node.js、Python、npm 或联网。构建使用 Windows PowerShell，把本地 vendor、CSS 和 JS 模块内嵌为单个 HTML。

## 栏目
- **圣经**：集中显示本机导入的圣经 JWPUB；可进入目录阅读。
- **出版物**：按分类浏览、搜索、收藏、调整分类和删除。
- **每日经文**：集中显示分类为每日经文的 JWPUB。具体日期与文档以出版物自身数据为准。
- **聚会**：集中显示聚会工作手册和相关资料。
- **更多**：批量导入、导出/恢复备份、管理最近阅读、书签和个人笔记。

## 阅读器
- 手机：全屏阅读，目录抽屉，字号、注音、书签、笔记和链接预览。
- 桌面：宽屏三栏工作区（左侧主导航、中间目录、右侧正文）。
- 根据出版物类型应用阅读样式；正文的原始层级、段落和媒体标签尽量保留。
- `jwpub://p/` 出版物链接、`jwpub://b/` 圣经链接可本地预览。导入器也会读取 ParagraphCommentary / VerseCommentary 表，`jwpub://c/` 链接会尝试按本地注释 ID 或文档 ID 匹配；由于现有测试样本没有 c 链接，实际地址匹配仍需要含该类链接的样本验证。

## 数据与迁移
- 保持 IndexedDB 名称 `OfflineJwLibrary`，并保留 books / notes / bookmarks / history store，避免升级时主动创建一套新数据库。
- 浏览器支持时会申请持久化存储，但不能保证 iOS 或 Sitecase 一定批准。
- Sitecase 若把新 HTML 作为独立项目，可能隔离本地数据库。更新前请在旧项目导出 v2 完整备份；测试新项目时通过“更多 → 恢复备份”迁移。旧项目不要删除。
- v2 备份包含 Blob、ArrayBuffer、TypedArray、出版物、原始 SQLite、图片资源、笔记、书签和历史；v1 兼容读取，但旧 v1 备份可能本身没有二进制图片数据。

## 验证边界
本项目可通过静态检查和本地 Chromium 自动化测试；但 iPhone Sitecase 的存储隔离、系统文件选择器、iOS 内存压力和各类 JWPUB 复杂排版仍须在目标设备实测。未匹配的内部链接不会联网，会显示说明。
