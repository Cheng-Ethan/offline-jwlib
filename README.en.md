# offline-jwlib · My Private Library

[English](README.en.md) · [简体中文](README.md)

> An offline, single-file, local-first JWPUB reader. Open one HTML file, import `.jwpub` / `.pub` publications, and unpack, decrypt, parse, read and annotate everything inside the browser — no server, no outbound application requests.

Current version: **0.13.0** (source of truth: [`project.json`](project.json)).

---

## What it is

`offline-jwlib` builds all modular sources into a self-contained `offline_library.html` at build time. That HTML can be:

- opened directly in a desktop browser;
- imported into iPhone Sitecase or similar local-HTML containers;
- archived as a long-lived offline library.

Books, images, notes, bookmarks, highlights, tags and history live in the browser's IndexedDB / localStorage. The application makes no business network requests; external links and remote resources are blocked or stripped.

## Features

- **Import**: batch JWPUB import with ZIP repair, decoding fallbacks, per-document error isolation and import reports.
- **Five sections**: Bible, Publications, Daily Text, Meetings, More.
- **Reader**: table of contents, search, internal link routing, footnotes/concordance, font sizing, pronunciation, page turning and a three-pane desktop layout.
- **Personal study**: notes, tags, highlights, bookmarks and history with stable IDs that survive language/year changes.
- **Backup**: full library and notes-only backups, legacy format compatibility and streaming restore.
- **Customisation**: category rules in `src/categories.json`, language packs, separated UI/content languages.

## Quick start

### End users

1. Obtain `offline_library.html` (a release asset or your own build).
2. Open it in a desktop browser, or import it into Sitecase.
3. Click **Import PUB** and select one or more `.jwpub` / `.pub` files.
4. Open a publication from a section home page.

### Developers

Windows:

```bat
build.bat
```

Cross-platform (requires Node.js, no `npm install`):

```bash
node build.mjs
```

The build reads [`project.json`](project.json) and inlines modules, styles, category rules and `src/vendor/` into `src/index.template.html`, producing:

- `offline_library.html`
- `dist/offline_library.html`

> `build.ps1` copies the previous HTML into `rollback/` before overwriting; `build.mjs` does not currently do this. See [Installation & build](docs/en/INSTALL.md).

## Documentation

| Document | Description |
|---|---|
| [Installation & build](docs/en/INSTALL.md) | Setup, build, artifacts, rollback, release checks |
| [Usage](docs/en/USAGE.md) | Import, reading, annotations, backup, operations |
| [Architecture](docs/en/ARCHITECTURE.md) | Modules, data flow, IndexedDB, security boundary |
| [Plugins & extension points](docs/en/PLUGINS.md) | Current hooks, language packs, category rules, plugin roadmap |
| [Backup format](docs/en/BACKUP_FORMAT.md) | JSON schema, binary packing, ID remapping |
| [Testing](docs/en/TESTING.md) | Test matrix, samples, on-device checklist |
| [Development plan](docs/en/DEVELOPMENT_PLAN.md) | P0–P3 roadmap and next tasks |
| [Contributing](CONTRIBUTING.md) | Workflow, commit rules, PR checklist |
| [Security policy](SECURITY.md) | Vulnerability reporting and privacy notes |
| [Code of conduct](CODE_OF_CONDUCT.md) | Community expectations |
| [Third-party notices](THIRD_PARTY_NOTICES.md) | Bundled dependencies and licences |
| [Changelog](CHANGELOG.md) | Version history |
| [中文文档](docs/) | Chinese documentation directory |

The legacy [`README_使用说明.md`](README_使用说明.md) and [`验证记录.md`](验证记录.md) are 0.4.0-era records kept for reference; prefer the documents above.

## Privacy & security

- Parsing and storage happen locally. There are no accounts, telemetry or business network calls.
- Notes, tags, highlights and history are stored unencrypted in local IndexedDB; exported backup JSON is not encrypted either. Do not export sensitive data on shared devices.
- Remote images/CSS are stripped and external links are blocked, but imported JWPUB files are still untrusted input. Report issues per [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE) © 2026 Cheng-Ethan. Bundled dependency licences are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
