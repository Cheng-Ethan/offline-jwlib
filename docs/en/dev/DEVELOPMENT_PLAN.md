# Development plan

[简体中文](../../dev/DEVELOPMENT_PLAN.md) · [Architecture](ARCHITECTURE.md) · [Testing](TESTING.md)

> Based on the 0.13.0 code. Principle: **fix correctness and security first, then engineering/release, then plugins and refactoring.**

## 0. Baseline

- Features are in place: import, five sections, reader, annotations, backup/restore.
- Documentation lags badly: historical docs say 0.4.0, code is 0.13.0.
- Build/release governance is messy: `_cf` files are unexplained; `build.mjs` and `build.ps1` behave differently.
- No automated tests; Sitecase has not been verified on device.
- No code-plugin system; data-type extensions (plugin v0) exist: user language packs and category rules.
- The current local workspace was initialised from API-fetched files as a **single-commit snapshot**, so its Git history differs from the remote (see [BUILD.md](BUILD.md)).

---

## P0 · Immediate (correctness & security)

| # | Task | Acceptance |
|---|---|---|
| P0-1 | Sync versions: complete CHANGELOG 0.5–0.13; mark legacy docs as historical | All docs point to 0.13.0; old records clearly labelled |
| P0-2 | Fix rich-title injection in `03-reader-links.js`: `titleRich` / `subtitleRich` must pass through `cleanHtml()` or fall back to plain text | Malicious PUB `<img onerror>` / `<script>` never executes; regression test added |
| P0-3 | Fix highlight colour injection in `style` attributes: allow only whitelisted colours | Invalid colours cannot inject extra CSS declarations |
| P0-4 | Add a baseline CSP: no external scripts/connections; allow required inline script/style and data/blob assets | Offline features unaffected; no outbound requests |
| P0-5 | Resolve `_cf` artifacts: exclude from releases and document their legacy origin | No unexplained `_cf` files in release artifacts |
| P0-6 | Repair local Git history once `github.com` is reachable: `git fetch origin`, reattach to `origin/main`, port documentation commits | `git log` shows remote history; `git push` needs no force; docs preserved |
| P0-7 | Add malicious-sample tests for P0-2/P0-3 | Suite covers both and passes |

### P0-6 suggested workflow (after network recovery)

```bash
cd offline_lib
git fetch origin
# Option A: keep working-tree changes, reset base to remote main
git branch backup-local-docs
git reset --soft origin/main
git commit -m "docs: add open-source documentation"

# Option B: follow remote history exactly
git fetch origin
git rebase origin/main develop
```

Back up the workspace first. Do **not** force-push to the remote until this is fixed.

---

## P1 · Engineering & release capability (1–2 iterations)

| # | Task | Acceptance |
|---|---|---|
| P1-1 | Minimal test system: `tests/build-check.mjs`, sanitizer tests, backup-format tests | Repeatable via `npm test` or equivalent |
| P1-2 | Unify `build.mjs` and `build.ps1`: rollback, artifact hashes, placeholder checks | Both produce identical artifacts with rollback protection |
| P1-3 | Complete dependency ledger: version, licence, source URL, hash, updated-at | `THIRD_PARTY_NOTICES.md` is auditable |
| P1-4 | Release checksums: generate `SHA256SUMS.txt` and use it in [RELEASING.md](RELEASING.md) | Every release includes checksums |
| P1-5 | Sitecase on-device tests: persistence, file picker, memory, image layout | Mobile matrix in [TESTING.md](TESTING.md) passes |
| P1-6 | Verify `jwpub://c/` with a real sample | Commentary links match locally or explain precisely why not |
| P1-7 | Backup robustness: integrity checks, failure messaging, non-atomic risks documented | Large/interrupted restores have defined behaviour |

---

## P2 · Formal extension system (2–4 iterations)

Goal: evolve "configuration points" into "controlled plugins" while keeping the app offline, safe and reversible.

### P2-1 Stable core API

- Evolve `window.__offlineLibrary` into a versioned API: `core/v1`;
- freeze category-rule, language-pack, backup identifiers and localStorage keys;
- breaking changes must bump `moduleApiVersion`.

### P2-2 Plugin infrastructure

- Design `plugin.json`: `id`, `version`, `apiVersion`, `permissions`, `entry`;
- implement `registerPlugin` / `activatePlugin` / `deactivatePlugin` / `listPlugins`;
- lifecycle: `validate → install → activate → deactivate → uninstall`;
- plugin state lives in the `system` store with deterministic enable order.

### P2-3 First extension points (increasing risk)

1. `catalog.classifyPublication`: classifier chain;
2. `language.pack`: formalise language packs;
3. `reader.theme`: scoped CSS only;
4. `reader.routeJwpubLink`: resolver chain with built-in fallthrough;
5. `backup.migrate`: migration hook with strict validation.

### P2-4 Isolation and security

- Web Worker or sandbox iframe + `postMessage`;
- deny `fetch` / XHR / WebSocket / `eval` / `new Function` by default;
- plugins get a limited facade, never the shared IIFE scope;
- storage namespace `plugin:<id>:`;
- one plugin's exception must not break startup;
- external plugins require explicit import and permission confirmation; verify hash/signature.

### P2-5 Examples and docs

- one classifier plugin example;
- one theme plugin example;
- plugin API compatibility tests;
- update [PLUGINS.md](PLUGINS.md) from "planned" to "implemented".

---

## P3 · Longer term

| # | Task | Notes |
|---|---|---|
| P3-1 | Refactor six-file shared IIFE into explicit modules | Use build-time bundling to avoid runtime ESM issues on `file://` |
| P3-2 | Replace blacklist `cleanHtml()` with a whitelist | Explicit allowed tags/attributes reduces XSS surface |
| P3-3 | Backup integrity checks and optional encryption | Encryption needs clear recovery and key-loss behaviour |
| P3-4 | Redacted diagnostic export | Allow sharing diagnostics without book titles/UA/storage details |
| P3-5 | Mobile enhancements | Only after on-device storage/memory limits are confirmed |
| P3-6 | Accessibility and i18n polish | Keyboard navigation, screen readers, RTL readiness |

---

## Suggested order

1. **Today**: update CHANGELOG to 0.13.0; fix `titleRich` / `subtitleRich` and highlight-colour injection; handle `_cf` files.
2. **When network returns**: repair Git history, reattach to `origin/main`, preserve documentation commits.
3. **This week**: add `tests/build-check.mjs` and sanitizer regressions; run the full matrix once.
4. **Next iteration**: unify build scripts, complete dependency ledger, run Sitecase on-device tests.
5. **After that**: start plugin API design. Do not write third-party plugins before the API is frozen.

## Explicit non-goals

- No server, account or cloud sync;
- no plugin system in P0/P1;
- no mobile-specific work before on-device validation;
- no sanitizer rewrite without regression tests.
