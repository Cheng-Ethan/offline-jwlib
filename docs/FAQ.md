# 常见问题 / FAQ

[English](en/FAQ.md) · [使用指南](USAGE.md)

## 仓库与开源

### 把 GitHub 仓库改成私有后，本地开发会报错吗？

**普通本地编辑和 `git commit` 不会报错，也不需要网络。** 只有与远端交互的命令会要求凭证：

```bash
git fetch
git pull
git push
git clone
```

当前 `origin` 是 HTTPS 地址。可以继续使用 Personal Access Token（需要 `repo` 读取/写入权限），或切换到 SSH：

```bash
git remote set-url origin git@github.com:Cheng-Ethan/offline-jwlib.git
```

如果仓库是私有且你之后要重新公开，只需在 GitHub 设置中调整可见性，本地代码不受影响。

### 为什么本地仓库和远端历史不一样？

开发环境中 `github.com` 的 Git 传输曾无法直连，当前本地工作区是通过 GitHub API 拉取 `main` 的全部文件后初始化的单个导入提交。它包含与远端 `main` 完全一致的文件内容（已用 Git blob SHA 逐个校验），但**没有远端提交历史**。

恢复方式：等 Git 网络可用后执行 `git fetch origin`，然后以 `origin/main` 为基线重新接入历史（可选方案见 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) P0）。在历史修复前，请勿把当前 `develop` 强制推送到远端。

### 许可证是什么？

[MIT](../LICENSE)。内嵌依赖见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。JWPUB 文件本身的版权归各自权利人所有；请仅导入你有权使用的资料。

## 使用

### 应用会联网吗？

不会发起业务请求。没有 `fetch`/XHR/WebSocket、没有外链脚本、没有遥测。远程图片与 CSS 会在清洗时剥离，外链点击会被拦截并提示。模板中的 JSZip、pako、sql.js 全部内嵌。

### 数据保存在哪里？

- IndexedDB：出版物、文档、资源、笔记、书签、高亮、标签、历史、分类；
- localStorage：界面语言、内容语言、注音开关、语言包、侧栏状态等。

应用没有服务器和账号。清除浏览器/Sitecase 数据会丢失这些内容，请定期导出备份。

### 为什么升级后书不见了？

Sitecase 可能把不同 HTML 项目隔离到不同 IndexedDB 空间。请从旧项目导出完整备份，在新项目中恢复，并保留旧项目直到验证完成。

### 支持多大的 JWPUB？

导入器限制：单文件 ≤ 380 MB、内部文件 ≤ 8000、单文档 ≤ 48 MB、失败率上限 0.6。低端 iOS 设备即使低于上限也可能因内存不足失败。大文件建议用桌面 Chrome 导入后再备份/恢复到设备。

### 视频和音频呢？

不保存音视频，正文中会替换为离线提示。这是有意的体积与离线约束。

### `jwpub://c/` 注释链接一定能用吗？

导入器会解析 `ParagraphCommentary` / `VerseCommentary` 并尝试本地匹配，但现有样本缺少含 `c` 链接的出版物，因此实际地址格式仍需样本验证。匹配失败会显示原因，不会联网。

### 可以开发插件吗？

当前没有插件系统。可以使用分类规则、语言包和自定义分类；诊断 API `window.__offlineLibrary` 不是插件 API。规划见 [PLUGINS.md](PLUGINS.md)。

## 构建

### Windows 和 Node 构建有什么区别？

- `build.bat` → 调用 `build.ps1`：会在覆盖前备份旧 HTML 到 `rollback/`；
- `node build.mjs`：跨平台，但不做 rollback，也不生成 `_cf` 变体。

发布前请按 [INSTALL.md](INSTALL.md) 的检查单执行。

### `offline_library_cf.html` 是什么？

未文档化的历史旁支产物，当前构建脚本不再生成。它与标准版在每日经文识别逻辑上不同。发布时请勿误用；处理方案见 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) P0。
