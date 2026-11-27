# 发布流程 / Release process

[English](../en/dev/RELEASING.md) · [安装与构建](../user/INSTALL.md)

## 1. 版本号规则

使用 `major.minor.patch`（当前 `2.0.0`）：

- `patch`：仅修复问题、文档、构建脚本；
- `minor`：新增功能、扩展点、备份字段（兼容旧数据）；
- `major`：破坏性变更（备份格式、模块 API、数据结构不兼容）。

版本以 `project.json` 的 `appVersion` 为唯一源头，必须同步：

- `src/modules/00-core-db.js` 中的版本常量；
- `CHANGELOG.md`；
- `README.md` / `README.en.md`；
- HTML meta（由构建注入）。

## 2. 发布前检查

1. 完成 [TESTING.md](TESTING.md) 的矩阵与验收标准。
2. 确认 `git status` 干净，当前分支为计划发布分支。
3. 按 [../user/INSTALL.md](../user/INSTALL.md) 构建两种环境产物。
4. 校验：
   - `offline_library.html` 与 `dist/offline_library.html` SHA-256 一致；
   - 模板无 `@@...@@` 残留；
   - 版本号在三处一致。
5. 处理 `_cf` 文件：本次发布明确排除，除非有文档说明其用途。
6. 生成 `SHA256SUMS.txt` 并与 HTML、源码归档一起发布。
7. 在 CHANGELOG 中写清新增、修复、已知问题与升级提示。

## 3. 发布产物

推荐发布：

- `offline_library.html`（主产物）
- `SHA256SUMS.txt`
- 源码归档（由 GitHub 生成即可）

不推荐发布：

- `offline_library_cf.html`（用途未文档化）
- `rollback/*.html`（开发中间产物）
- 含个人 JWPUB 样本的目录

## 4. 升级提示模板

> 升级前请先导出完整备份并保留旧 HTML/旧 Sitecase 项目。新版本可能升级 IndexedDB 结构；回滚 HTML 不会自动回滚数据。

## 5. 发布后

- 在 GitHub Release 中附带校验和；
- 确认文档链接可访问；
- 收集 Sitecase 真机反馈；
- 如发现 P0 问题，立即发布 patch 并在 CHANGELOG 标注。
