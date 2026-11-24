# 安装到设备 / Install on your device

[English](../en/user/INSTALL.md) · [使用指南](USAGE.md) · [移动端说明](MOBILE.md) · [用户首页](../../README.md)

## 你不需要构建

普通用户**不需要** Node.js、PowerShell、npm 或联网。你只需要一个 `offline_library.html` 文件——从发布页下载，或让开发者给你一份。

> 开发者构建说明在 [docs/dev/BUILD.md](../dev/BUILD.md)，用户不用看。

## 1. 桌面电脑（Windows / macOS / Linux）

1. 把 `offline_library.html` 放到任意文件夹。
2. 双击打开，或用浏览器打开它。
3. 推荐 Chromium 系浏览器（Chrome / Edge）。
4. 点击「导入 PUB」，选择你的 `.jwpub` / `.pub` 文件开始使用。

如果浏览器提示“本地存储不可用”，换一个支持本地存储的现代浏览器再试。不要通过会修改文件的网盘同步目录直接打开。

## 2. iPhone / iPad

推荐用 **Sitecase** 这类支持导入本地 HTML 的容器 App：

1. 在旧项目中先导出完整备份（「更多 → 备份图书馆」）。
2. 把 `offline_library.html` 作为新项目导入 Sitecase。
3. 在新项目中用「恢复整个图书馆」导入刚才的备份。
4. 验证阅读、图片、笔记和历史都正常后，再删除旧项目。

> 不同 HTML 项目可能使用独立的本地数据库，不要假设新文件会自动继承旧数据。详细步骤和替代方案见 [移动端说明](MOBILE.md)。

## 3. 安卓手机 / 平板

安卓上不建议直接用 `file://` 打开（部分浏览器会禁用本地数据库）。推荐做法见 [移动端说明](MOBILE.md)：本地 HTTP 服务方式最稳，WebView 容器方式也可以但需真机验证。

## 4. 升级与备份

每次升级前：

1. 导出完整备份；
2. 保留旧 HTML 和旧项目；
3. 打开/导入新 HTML；
4. 恢复备份并验证；
5. 确认无误后再清理旧版本。

替换 HTML **不会自动回滚数据**。如果新版升级过本地数据结构，旧 HTML 可能无法读取新数据。

## 5. 接着做什么

- [使用指南](USAGE.md)：导入、阅读、笔记、备份、语言包
- [移动端说明](MOBILE.md)：iPhone / Android 具体打开方式
- [FAQ](FAQ.md)：常见问题

数据只保存在你的设备里，应用不会联网。升级或换设备前请务必备份。
