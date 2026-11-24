# 回滚说明

> 补充：只有 `build.bat` / `build.ps1` 会自动生成这里的备份；`node build.mjs` 目前不会。详见 [安装与构建](../docs/INSTALL.md)。

每次运行 `build.bat` 前，如果项目根目录已有 `offline_library.html`，构建脚本会先把它复制到本目录，文件名带有构建时间。

需要回滚时：
1. 关闭 Sitecase / 浏览器中的阅读器。
2. 从本目录选择要回滚的 `offline_library_时间.html`。
3. 复制到项目根目录并改名为 `offline_library.html`，或直接导入旧 HTML。
4. 不要删除旧 Sitecase 项目；如果新项目使用了独立的 IndexedDB，请从之前导出的备份恢复数据。

回滚 HTML 文件不会自动回滚 IndexedDB 中已经更新过的数据结构。当前项目维持 IndexedDB 名称和 store 不变，仍建议在每次升级前导出完整备份。
