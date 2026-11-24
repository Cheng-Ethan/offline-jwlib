# FAQ

[简体中文](../FAQ.md) · [Usage](USAGE.md)

## Repository and open source

### Will local development break if I make the GitHub repository private?

**Local edits and `git commit` keep working, with no network required.** Only remote operations ask for credentials:

```bash
git fetch
git pull
git push
git clone
```

`origin` currently uses HTTPS. You can keep using a Personal Access Token (with `repo` access) or switch to SSH:

```bash
git remote set-url origin git@github.com:Cheng-Ethan/offline-jwlib.git
```

Changing visibility back to public later does not affect local code.

### Why does the local repository history differ from the remote?

The dev environment could not reach `github.com` over Git, so the local workspace was initialised from all `main` files fetched via the GitHub API as a single import commit. File contents were verified byte-for-byte against the remote via Git blob SHA, but **remote commit history is absent**.

Once Git access works, run `git fetch origin` and reattach to `origin/main` (options in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), P0). Do not force-push the current `develop` before fixing history.

### What is the licence?

[MIT](../../LICENSE). Bundled dependencies are listed in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md). JWPUB files remain the property of their respective rights holders; import only material you are entitled to use.

## Usage

### Does the app access the network?

It makes no business requests. No `fetch`/XHR/WebSocket, no remote scripts, no telemetry. Remote images and CSS are stripped during sanitising; external link clicks are intercepted with a notice. JSZip, pako and sql.js are fully inlined.

### Where is data stored?

- IndexedDB: books, documents, assets, notes, bookmarks, highlights, tags, history, categories;
- localStorage: UI/content language, pronunciation, language packs, sidebar state.

There is no server or account. Clearing browser/Sitecase data deletes this content, so export backups regularly.

### Why are books missing after an upgrade?

Sitecase may isolate IndexedDB per HTML project. Export a full backup from the old project, restore it in the new one, and keep the old project until verification succeeds.

### How large can a JWPUB be?

Import limits: 380 MB per file, 8000 internal files, 48 MB per document, failure ratio 0.6. Low-end iOS devices can still fail from memory pressure. For very large files, import in desktop Chrome, then back up and restore to the device.

### What about video and audio?

They are not stored; articles show an offline placeholder. This is intentional to keep the build small and offline.

### Are `jwpub://c/` commentary links guaranteed to work?

The importer parses `ParagraphCommentary` / `VerseCommentary` and tries local matching, but available samples lack `c` links, so the real address format needs sample-based verification. Unmatched links explain the reason and never go online.

### Can I write plugins?

Not yet. Category rules, language packs and custom categories are available. `window.__offlineLibrary` is diagnostics, not a plugin API. See [PLUGINS.md](PLUGINS.md).

## Build

### What is the difference between the Windows and Node builds?

- `build.bat` → `build.ps1`: backs up the previous HTML to `rollback/` before overwriting;
- `node build.mjs`: cross-platform, but no rollback and no `_cf` variant.

Use the checklist in [INSTALL.md](INSTALL.md) before release.

### What is `offline_library_cf.html`?

An undocumented legacy side-branch artifact no longer produced by current build scripts. It differs from the standard build in daily-text detection. Do not ship by mistake; see [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), P0.
