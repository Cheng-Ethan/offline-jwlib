# offline-jwlib · My Private Library

[English](README.en.md) · [简体中文](README.md)

> An offline, single-file, local-first JWPUB reader. Open one HTML, import `.jwpub` / `.pub`, unpack/decrypt/parse/read/annotate in the browser — no server, no outbound application requests.

Current version: **0.13.0** (baseline, see [AGENTS.md](AGENTS.md)).

---

## I am a user

You need no Node.js, npm or network — just one `offline_library.html` file.

| Document | What you will learn |
|---|---|
| [Install on device](docs/en/user/INSTALL.md) | Desktop, iPhone/iPad import, backup before upgrade |
| [Usage](docs/en/user/USAGE.md) | Import, reading, search, notes, backup/restore, language packs |
| [Mobile guide](docs/en/user/MOBILE.md) | Sitecase on iPhone; local-server/WebView options on Android |
| [FAQ](docs/en/user/FAQ.md) | Where data lives, missing books after upgrade, blocked external links |

Quick start: open `offline_library.html` → click **Import PUB** → choose `.jwpub` / `.pub` → read from a section home. **Always export a full backup before upgrading.**

## I am a developer / maintainer

Read [AGENTS.md](AGENTS.md) first: it defines branches, versions, doc ownership and commit rules as the single source of truth for every session.

| Document | Contents |
|---|---|
| [Development rules (quick ref)](docs/en/dev/DEVELOPMENT_RULES.md) | Human-readable version/branch/doc rules |
| [Build & artifacts](docs/en/dev/BUILD.md) | Build scripts, placeholders, artifacts, rollback, private-repo Git |
| [Architecture](docs/en/dev/ARCHITECTURE.md) | Modules, data flow, IndexedDB, security boundary |
| [Plugins & extension points](docs/en/dev/PLUGINS.md) | Hooks, language pack (plugin v0), plugin roadmap |
| [Backup format](docs/en/dev/BACKUP_FORMAT.md) | JSON schema, binary packing, ID remapping |
| [Testing](docs/en/dev/TESTING.md) | Test matrix, samples, acceptance criteria |
| [Releasing](docs/en/dev/RELEASING.md) | Versioning, release checklist, checksums |
| [Development plan](docs/en/dev/DEVELOPMENT_PLAN.md) | P0–P3 roadmap and next steps |
| [Design specs](docs/superpowers/specs/) | Archived design decisions |

Additional docs: [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Changelog](CHANGELOG.md)

## Key conventions

- Baseline version `0.13.0`; this documentation restructure does not bump it.
- Commits go to `develop`; `master` is published periodically by the user; agents do not push it.
- User language JSON is a **user language pack (plugin v0)**: UI strings only, not a code plugin API.
- Data stays in local IndexedDB / localStorage; backup JSON is unencrypted.
- Legacy docs [`README_使用说明.md`](README_使用说明.md), [`验证记录.md`](验证记录.md) and [`rollback/README_回滚说明.md`](rollback/README_回滚说明.md) are historical references only.

## Licence

[MIT](LICENSE) © 2026 Cheng-Ethan. Bundled dependencies: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
