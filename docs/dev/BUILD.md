# 构建与产物 / Build & artifacts

[English](../en/dev/BUILD.md) · [安装到设备](../user/INSTALL.md) · [架构说明](ARCHITECTURE.md) · [发布流程](RELEASING.md)

本文只给开发者看。用户只需要一个 HTML 文件，见 [用户安装文档](../user/INSTALL.md)。

## 1. 构建环境

| 场景 | 要求 |
|---|---|
| Windows | PowerShell 5+；双击 `build.bat` |
| 跨平台 / CI | Node.js 18+；**不需要** `npm install` |
| 运行时 | 支持 IndexedDB、File API、Blob URL 的现代浏览器 |

## 2. 两条构建路径

### Windows：`build.bat`

```bat
build.bat
```

实际调用：

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
```

`build.ps1` 会：

1. 读取 `project.json`；
2. 按 `modules.order` 拼接 `src/modules/*.js`；
3. 替换模板占位符；
4. **覆盖前**把旧 HTML 备份到 `rollback/offline_library_<时间戳>.html`；
5. 写出 `offline_library.html` 和 `dist/offline_library.html`。

### Node：`node build.mjs`

```bash
node build.mjs
```

替换逻辑与 `build.ps1` 一致，但**目前不生成 rollback 备份**，也不生成 `_cf` 变体。发布前需手动补上该步骤（见 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) P1-2）。

## 3. 构建输入

`project.json` 关键字段：

| 字段 | 当前值 | 说明 |
|---|---|---|
| `appVersion` | `2.0.1` | 当前版本，写入 HTML meta 与运行时 `APP_VERSION` |
| `moduleApiVersion` | `1` | 模块 API 版本校验 |
| `indexedDbName` | `OfflineJwLibrary` | 升级时尽量不变 |
| `indexedDbVersion` | `5` | 数据库版本（原始包使用独立数据库） |
| `backupFormat` | `offline-library-library-v2` | 完整备份格式标识 |
| `notesBackupFormat` | `offline-library-notes-v1` | 笔记备份格式标识 |
| `modules.order` | `00` → `05` | 拼接顺序不可随意调整 |
| `vendor` | `jszip.js`、`pako.js`、`sql-wasm.js` | 全部内嵌 |

`src/index.template.html` 占位符：

| 占位符 | 内容 |
|---|---|
| `@@APP_VERSION@@` | 版本 meta |
| `@@CSS@@` | `src/styles.css` |
| `@@VENDOR_JSZIP@@` / `@@VENDOR_PAKO@@` / `@@VENDOR_SQLITE@@` | 内嵌第三方库 |
| `@@CATEGORIES_JSON@@` | `window.__CATEGORY_CONFIG__` |
| `@@APP_JS@@` | 六个模块拼成的单个 IIFE |

## 4. 输出产物

- `offline_library.html`：根目录标准产物。
- `dist/offline_library.html`：发布副本，与根目录一致。
- `offline_library_cf.html` / `dist/offline_library_cf.html`：**未文档化的历史旁支产物**，当前构建脚本不再生成；与标准版在每日经文识别上不同。发布时排除，处理方案见 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) P0-5。
- `rollback/*.html`：仅 `build.ps1` 生成。

## 5. 版本同步

版本唯一源头是 `project.json` 的 `appVersion`。改动版本时必须同步：

1. `project.json`；
2. `src/modules/00-core-db.js` 的版本常量；
3. `CHANGELOG.md`；
4. `README.md` / `README.en.md`；
5. HTML meta 由构建注入，不手改产物。

具体升版规则见 [AGENTS.md](../../AGENTS.md) 与 [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)。

## 6. 私有仓库与 Git

仓库设为私有后，本地 `git commit` 不受影响；`fetch` / `pull` / `push` / `clone` 需要凭证：

```bash
# HTTPS + Token，或改用 SSH
git remote set-url origin git@github.com:Cheng-Ethan/offline-jwlib.git
```

分支规则见 [AGENTS.md](../../AGENTS.md)：提交进 `develop`，`master` 由用户定期发布，agent 不直接 push `master`。

### 本地工作区历史说明

当前工作区是通过 GitHub API 拉取 `main` 的全部文件后初始化的单个提交；文件内容与远端一致，但没有远端提交历史。网络恢复后按 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) P0-6 重新接入 `origin/main`。在修复前不要 force push。

## 7. 构建检查单

- [ ] `project.json` 版本与 README / CHANGELOG 一致；
- [ ] 拼接模块通过 `node --check`；
- [ ] 模板无未替换 `@@...@@`；
- [ ] 根目录与 `dist/` HTML 哈希一致；
- [ ] `_cf` 文件已明确排除或说明；
- [ ] 生成 SHA-256 校验和。

完整发布流程见 [RELEASING.md](RELEASING.md)。
