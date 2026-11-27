# Development rules (human-readable)

[简体中文](../../dev/DEVELOPMENT_RULES.md) · [Canonical source: AGENTS.md](../../../AGENTS.md)

This is a quick reference for people. **Agents and automation must use [`AGENTS.md`](../../../AGENTS.md) at the repo root**; if anything differs, AGENTS.md wins.

## Current baseline

- Version: **2.0.0** (initial baseline 0.13.0)
- Development branch: `develop`
- Release branch: `master` (published periodically by the user; agents do not push it)
- `main`: upstream import reference, not used for new work

## Version quick rules

| Change | Version |
|---|---|
| Breaking change (backup format, module API, data structure) | `x.0.0` |
| New feature / capability / extension point / platform support | `0.x.0` |
| Non-breaking docs or build improvement | `0.x.y` |
| Pure bug fix | **no bump** |

When bumping, sync: `project.json` → version constant in `src/modules/00-core-db.js` → `CHANGELOG.md` → `README.md` / `README.en.md`. HTML meta is injected by the build.

## Documentation ownership

- Users: `docs/user/` (install, usage, mobile, FAQ)
- Developers: `docs/dev/` (build, architecture, plugins, backup, testing, release, plan, rules)
- English: `docs/en/user/`, `docs/en/dev/`

Keep user docs free of developer jargon. Every doc change must update both languages and the README tables. Every new or changed user-visible behaviour must also update `CHANGELOG.md`, the relevant user/dev docs and their English mirrors; code-only changes are not enough.

## Language pack = plugin v0

A user language JSON is a **data-only extension (plugin v0)**: it replaces UI strings only. It cannot run code or access book data. A full code-plugin system does not exist yet.

## Commits

- Commit to `develop`; do not push `master` directly;
- `type: short description`, one thing per commit;
- never commit personal JWPUB samples, backups or secrets;
- security issues go through `SECURITY.md`.
