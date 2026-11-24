# 安装与构建 / Installation & build

[English](en/INSTALL.md) · [返回中文首页](../README.md)

## 1. 运行环境

| 场景 | 要求 |
|---|---|
| Windows 构建 | Windows PowerShell 5+，双击 `build.bat` 即可 |
| 跨平台构建 | Node.js 18+；**不需要** `npm install` |
| 桌面运行 | 支持 IndexedDB、File API、Blob URL 的现代浏览器（推荐 Chromium 系） |
| iOS 运行 | Sitecase 或其他允许导入本地 HTML 的容器，需真机验证 |
| 可选能力 | WebCrypto（无则回退到内置 JS 实现）；`DecompressionStream`（无则由 pako 回退） |

应用是单文件 HTML，不需要服务器，不需要联网，也不需要 Service Worker。

## 2. 从源码构建

### Windows

```bat
build.bat
```

`build.bat` 只是调用：

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
```

`build.ps1` 会：

1. 读取 `project.json`；
2. 按 `modules.order` 顺序拼接 `src/modules/*.js`；
3. 替换模板占位符；
4. **在覆盖前**把旧 HTML 备份到 `rollback/offline_library_<时间戳>.html`；
5. 写出 `offline_library.html` 与 `dist/offline_library.html`。

### macOS / Linux / CI

```bash
node build.mjs
```

`build.mjs` 与 `build.ps1` 的替换逻辑一致，但**目前不执行 rollback 备份**，也不会生成 `_cf` 变体。发布前建议手动备份或自行加上该步骤（见 `docs/DEVELOPMENT_PLAN.md` P1）。

## 3. 构建输入与输出

`project.json` 关键字段：

| 字段 | 当前值 | 说明 |
|---|---|---|
| `appVersion` | `0.13.0` | 写入 HTML meta 与运行时 `APP_VERSION` |
| `moduleApiVersion` | `1` | 模块 API 版本校验 |
| `indexedDbName` | `OfflineJwLibrary` | 数据库名，升级时尽量不变 |
| `indexedDbVersion` | `5` | 数据库版本 |
| `backupFormat` | `offline-library-library-v1` | 完整备份格式标识 |
| `notesBackupFormat` | `offline-library-notes-v1` | 笔记备份格式标识 |
| `modules.order` | `00` → `05` | 拼接顺序不可随意调整 |
| `vendor` | `jszip.js`、`pako.js`、`sql-wasm.js` | 全部内嵌 |

`src/index.template.html` 中的占位符：

| 占位符 | 内容 |
|---|---|
| `@@APP_VERSION@@` | 版本号 meta |
| `@@CSS@@` | `src/styles.css` |
| `@@VENDOR_JSZIP@@` / `@@VENDOR_PAKO@@` / `@@VENDOR_SQLITE@@` | 第三方库 |
| `@@CATEGORIES_JSON@@` | `window.__CATEGORY_CONFIG__` |
| `@@APP_JS@@` | 六个应用模块拼接后的单个 IIFE |

输出：

- `offline_library.html`：根目录标准产物。
- `dist/offline_library.html`：与根目录一致，用于发布。
- `offline_library_cf.html` / `dist/offline_library_cf.html`：**未文档化的历史旁支产物**，当前构建脚本不再生成。两者内容一致，但与标准版在每日经文识别逻辑上不同。发布时请勿误用；处理方案见开发计划 P0。
- `rollback/*.html`：`build.ps1` 生成的旧版本备份。

## 4. 安装到设备

### 桌面浏览器

直接双击 `offline_library.html`。建议用 Chromium 系浏览器并在首次导入前确认站点/文件存储权限。

注意：不同浏览器对 `file://` 下的 IndexedDB、Blob URL 与持久化存储的策略不同。若出现“本地存储不可用”，请换用支持的浏览器或通过本地 HTTP 服务打开后再验证。

### iPhone Sitecase

1. 在旧项目中先导出完整备份（「更多 → 备份图书馆」）。
2. 把新的 `offline_library.html` 作为新项目导入 Sitecase。
3. 在新项目中使用「恢复整个图书馆」导入备份。
4. 确认阅读、图片、笔记与历史都正常后，再考虑删除旧项目。

> Sitecase 可能把不同 HTML 项目隔离到不同 IndexedDB 空间。不要假设新 HTML 会自动继承旧数据。详见 [USAGE.md](USAGE.md) 与 [TESTING.md](TESTING.md)。

## 5. 升级与回滚

1. 升级前导出完整备份。
2. 保留旧 HTML 与旧 Sitecase 项目。
3. 替换/导入新 HTML。
4. 验证成功后，再清理旧版本。

回滚只能替换 HTML 文件；**不会自动回滚 IndexedDB 结构或数据**。如果新版升级过数据库结构，旧 HTML 可能无法读取新数据。此时应回到旧项目环境，或用备份恢复到兼容状态。

## 6. 发布检查单

- [ ] `project.json` 的版本与 `CHANGELOG.md`、`README.md` 一致。
- [ ] `node --check` 通过（拼接后的模块可先在临时文件中检查）。
- [ ] 模板中没有未替换的 `@@...@@` 占位符。
- [ ] `offline_library.html` 与 `dist/offline_library.html` 哈希一致。
- [ ] 明确处理 `_cf` 文件：归档、删除或写明用途。
- [ ] 生成并发布 SHA-256 校验和。
- [ ] 在 Chromium 与 Sitecase 真机各跑一遍 [TESTING.md](TESTING.md) 清单。

## 7. 私有仓库与构建

把 GitHub 仓库设为私有后：

- 本地编辑和 `git commit` **不受影响**，不需要网络；
- `git clone` / `git fetch` / `git pull` / `git push` 需要凭证（Personal Access Token 或 SSH key）；
- 当前 `origin` 使用 HTTPS。可继续保持 HTTPS + Token，或改为 SSH：

```bash
git remote set-url origin git@github.com:Cheng-Ethan/offline-jwlib.git
```

详见 [FAQ.md](FAQ.md)。
