# Installation & build

[简体中文](../INSTALL.md) · [English README](../../README.en.md)

## 1. Requirements

| Scenario | Requirement |
|---|---|
| Windows build | Windows PowerShell 5+; double-click `build.bat` |
| Cross-platform build | Node.js 18+; **no** `npm install` needed |
| Desktop runtime | Modern browser with IndexedDB, File API and Blob URLs (Chromium recommended) |
| iOS runtime | Sitecase or another local-HTML container; verify on a real device |
| Optional | WebCrypto (falls back to built-in JS); `DecompressionStream` (falls back to pako) |

The app is a single HTML file. It needs no server, no network and no Service Worker.

## 2. Build from source

### Windows

```bat
build.bat
```

`build.bat` simply runs:

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
```

`build.ps1`:

1. reads `project.json`;
2. concatenates `src/modules/*.js` in `modules.order`;
3. replaces template placeholders;
4. **backs up the previous HTML** to `rollback/offline_library_<timestamp>.html`;
5. writes `offline_library.html` and `dist/offline_library.html`.

### macOS / Linux / CI

```bash
node build.mjs
```

`build.mjs` performs the same replacements but **does not currently create a rollback copy** and does not generate the `_cf` variant. Add that step yourself before release (see `docs/en/DEVELOPMENT_PLAN.md`, P1).

## 3. Inputs and outputs

Key `project.json` fields:

| Field | Current value | Meaning |
|---|---|---|
| `appVersion` | `0.13.0` | HTML meta and runtime `APP_VERSION` |
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
| `@@APP_JS@@` | Six app modules as one IIFE |

Outputs:

- `offline_library.html`: standard root artifact.
- `dist/offline_library.html`: identical release copy.
- `offline_library_cf.html` / `dist/offline_library_cf.html`: **undocumented legacy side branch**. Current build scripts no longer produce them. They differ from the standard build in daily-text detection. Do not ship by mistake; see the development plan P0.
- `rollback/*.html`: previous HTML copies created by `build.ps1`.

## 4. Install on a device

### Desktop browser

Open `offline_library.html` directly. Chromium-based browsers are recommended. Confirm file/storage permissions before the first import.

`file://` IndexedDB, Blob URL and persistence behaviour varies by browser. If you see “local storage unavailable”, try another browser or serve over local HTTP for diagnosis.

### iPhone Sitecase

1. Export a full backup from the old project first.
2. Import the new `offline_library.html` as a new Sitecase project.
3. Restore the backup with **Restore full library**.
4. Verify reading, images, notes and history before deleting the old project.

> Sitecase may isolate IndexedDB per HTML project. Do not assume the new HTML inherits old data. See [USAGE.md](USAGE.md) and [TESTING.md](TESTING.md).

## 5. Upgrade and rollback

1. Export a full backup before upgrading.
2. Keep the old HTML and old Sitecase project.
3. Replace/import the new HTML.
4. Validate, then clean up old versions.

Rollback only replaces the HTML; it **does not roll back IndexedDB schema or data**. If the new version migrated the database, the old HTML may not read the new data. Return to the old project or restore from a compatible backup.

## 6. Release checklist

- [ ] `project.json` version matches `CHANGELOG.md` and `README.md`.
- [ ] `node --check` passes on the concatenated modules.
- [ ] No unresolved `@@...@@` placeholders in the template.
- [ ] `offline_library.html` and `dist/offline_library.html` hashes match.
- [ ] `_cf` files explicitly archived, removed or documented.
- [ ] SHA-256 checksums generated and published.
- [ ] Full [TESTING.md](TESTING.md) matrix run on Chromium and Sitecase.

## 7. Private repository and builds

After making the GitHub repository private:

- local edits and `git commit` keep working offline;
- `git clone`, `git fetch`, `git pull` and `git push` require credentials (PAT or SSH key);
- `origin` currently uses HTTPS. Keep HTTPS + Token, or switch to SSH:

```bash
git remote set-url origin git@github.com:Cheng-Ethan/offline-jwlib.git
```

See [FAQ.md](FAQ.md).
