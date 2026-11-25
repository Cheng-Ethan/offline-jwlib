# Testing

[简体中文](../../dev/TESTING.md) · [Architecture](ARCHITECTURE.md)

## 1. Current state

There is **no automated test framework** yet (no `package.json`, no test scripts). [`验证记录.md`](../../../验证记录.md) is a one-off 0.4.0-era record, not a repeatable suite. Building a test system is a P1 item in the development plan.

## 2. Existing validation (historical record)

- concatenated modules pass `node --check`;
- no unresolved template placeholders;
- section navigation works in Chromium;
- real samples `g_CHS_202611.jwpub` and `S-401_CHS.jwpub` imported successfully;
- opening an Awake! article, images, TOC and desktop layout passed;
- no failed external requests observed in the test environment.

Not yet verified: Windows PowerShell build, Sitecase on a real device, `jwpub://c/` links, complex magazine layout, fonts, multimedia, low-memory devices.

## 3. Test matrix

| Layer | Environment | Required coverage |
|---|---|---|
| Static | Node.js | `node --check` on concatenated output; placeholder scan; version consistency across `project.json` and docs |
| Build | Windows PowerShell + Node | identical outputs; `build.ps1` produces a rollback copy |
| Desktop browser | Chromium (primary), Firefox/Safari (compat) | five sections, import, reading, search, annotations, backup/restore |
| Mobile | iPhone Sitecase on device | local HTML import, IndexedDB persistence, file picker, memory, image layout |
| Security | Malicious samples | XSS, remote resources, external links, damaged ZIP, oversized files |

## 4. Sample set

Prepare at least:

- Bible JWPUB (with `BibleVerse`);
- book JWPUB;
- magazine JWPUB (complex layout, images, fonts);
- daily text JWPUB (with `DatedText`);
- meeting workbook;
- a publication with `ParagraphCommentary` / `VerseCommentary` and `jwpub://c/` links;
- multilingual publications (cross-language notes/highlights);
- damaged ZIP (missing central directory), empty file, oversized file.

## 5. Key regression cases

### Import

1. Single and batch import;
2. re-import same publication, confirm overwrite keeps notes;
3. isolated document decode failures do not break the rest;
4. old generation remains usable if import fails;
5. import report is accurate.

### Reading

1. TOC navigation, back stack, return-to-search-results;
2. local routing for `jwpub://p/`, `jwpub://b/`, `jwpub://c/`;
3. unresolved links explain the reason and never go online;
4. external link clicks are intercepted; the warning sits above the link popover and closes independently;
5. remote images/CSS produce no network requests;
6. desktop three-pane and mobile full-screen transitions;
7. TOC, search, paging, bookmark, notes, language, pronunciation and font size in the three-dot menu;
8. switching tabs resumes the same paragraph, and reload/reopen/import preserves position and history;
9. link-preview titles navigate to the target article and back returns to the source publication;
10. pencil note markers, active block highlight, and one merged outline per highlighted line.

### Data

1. Stable IDs do not drift across years/languages;
2. highlights stay aligned after restore;
3. note undo/redo;
4. backup → clear → restore produces identical data;
5. legacy v1/v2/v3 backups restore correctly;
6. large streaming restore does not crash.

### Security

1. `<script>`, `onerror` and `javascript:` URLs in article HTML are removed;
2. remote `<img>` / `<link>` / CSS `url()` are stripped;
3. `titleRich` / `subtitleRich` injection test (known P0 risk);
4. highlight-colour style injection test;
5. damaged ZIP does not hang or crash.

## 6. Acceptance criteria

- The built artifact works offline end-to-end: import → read → annotate → backup → restore;
- no business requests in the network panel;
- one full pass on desktop and one on Sitecase hardware;
- every known P0 security issue has a passing regression test;
- version, CHANGELOG, README and release artifacts agree.

## 7. Suggested next steps

Create a minimal runnable suite under `tests/`:

1. `tests/build-check.mjs`: placeholders, version, `node --check`, artifact hashes;
2. `tests/sanitizer.spec.*`: verify `cleanHtml()` with jsdom/happy-dom;
3. `tests/backup-format.spec.*`: packing/unpacking and ID remapping (pure functions runnable in Node);
4. browser E2E via Playwright later in P1.

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).
