# Build & artifacts

[简体中文](../../dev/BUILD.md) · [Install on device](../user/INSTALL.md) · [Architecture](ARCHITECTURE.md) · [Releasing](RELEASING.md)

This document is for developers. End users only need one HTML file; see [user installation](../user/INSTALL.md).

## 1. Build environment

| Scenario | Requirement |
|---|---|
| Windows | PowerShell 5+; double-click `build.bat` |
| Cross-platform / CI | Node.js 18+; **no** `npm install` |
| Runtime | Modern browser with IndexedDB, File API and Blob URLs |

## 2. Two build paths

### Windows: `build.bat`

```bat
build.bat
```

It runs:

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
```

`build.ps1`:

1. reads `project.json`;
2. concatenates `src/modules/*.js` in `modules.order`;
3. replaces template placeholders;
4. **backs up the old HTML** to `rollback/offline_library_<timestamp>.html` before overwriting;
5. writes `offline_library.html` and `dist/offline_library.html`.

### Node: `node build.mjs`

```bash
node build.mjs
```

Same replacements, but **no rollback copy** and no `_cf` variant. Add that step before release (see [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), P1-2).

## 3. Build inputs

Key `project.json` fields:

| Field | Current value | Meaning |
|---|---|---|
| `appVersion` | `0.14.0` | Current version; HTML meta and runtime `APP_VERSION` |
| `moduleApiVersion` | `1` | Module API version check |
| `indexedDbName` | `OfflineJwLibrary` | Keep stable across upgrades |
| `indexedDbVersion` | `5` | Database version |
| `backupFormat` | `offline-library-library-v1` | Full-backup format id |
| `notesBackupFormat` | `offline-library-notes-v1` | Notes-backup format id |
| `modules.order` | `00` → `05` | Concatenation order; do not reorder casually |
| `vendor` | `jszip.js`, `pako.js`, `sql-wasm.js` | Fully inlined |

Placeholders in `src/index.template.html`:

| Placeholder | Content |
|---|---|
| `@@APP_VERSION@@` | Version meta |
| `@@CSS@@` | `src/styles.css` |
| `@@VENDOR_JSZIP@@` / `@@VENDOR_PAKO@@` / `@@VENDOR_SQLITE@@` | Vendored libraries |
| `@@CATEGORIES_JSON@@` | `window.__CATEGORY_CONFIG__` |
| `@@APP_JS@@` | Six modules as one IIFE |

## 4. Output artifacts

- `offline_library.html`: standard root artifact.
- `dist/offline_library.html`: release copy, identical to root.
- `offline_library_cf.html` / `dist/offline_library_cf.html`: **undocumented legacy side branch**, no longer produced; differs in daily-text detection. Exclude from releases; see [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), P0-5.
- `rollback/*.html`: created only by `build.ps1`.

## 5. Version sync

`appVersion` in `project.json` is the single source of truth. When changing it, update:

1. `project.json`;
2. version constant in `src/modules/00-core-db.js`;
3. `CHANGELOG.md`;
4. `README.md` / `README.en.md`;
5. HTML meta is injected by the build — never edit the artifact by hand.

See [AGENTS.md](../../../AGENTS.md) and [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) for the bump rules.

## 6. Private repository and Git

After the repo becomes private, local `git commit` still works. `fetch` / `pull` / `push` / `clone` need credentials:

```bash
# HTTPS + Token, or switch to SSH
git remote set-url origin git@github.com:Cheng-Ethan/offline-jwlib.git
```

Branch rules in [AGENTS.md](../../../AGENTS.md): commits go to `develop`; `master` is published periodically by the user; agents do not push `master` directly.

### Local workspace history

The current workspace was initialised from all `main` files fetched via the GitHub API as a single commit. Contents match the remote, but remote commit history is absent. Reattach to `origin/main` per [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), P0-6, once the network allows. Do not force-push before that.

## 7. Build checklist

- [ ] `project.json` version agrees with README / CHANGELOG;
- [ ] concatenated modules pass `node --check`;
- [ ] no unresolved `@@...@@` placeholders;
- [ ] root and `dist/` HTML hashes match;
- [ ] `_cf` files explicitly excluded or documented;
- [ ] SHA-256 checksums generated.

Full release flow: [RELEASING.md](RELEASING.md).
