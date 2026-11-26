# Architecture

[简体中文](../../dev/ARCHITECTURE.md) · [Usage](../user/USAGE.md)

## 1. Architecture in one sentence

> At build time, six JS modules are concatenated into **one shared-scope IIFE** and inlined into a single HTML. At runtime the browser performs the whole chain JWPUB → ZIP → SQLite → decryption → DOM → IndexedDB, and all data stays on the device.

```text
src/index.template.html
  ├── src/styles.css
  ├── src/categories.json  → window.__CATEGORY_CONFIG__
  ├── src/vendor/{jszip,pako,sql-wasm}.js
  └── src/modules/00..05  ──concat──▶ one <script> IIFE
                                      │
                                      ▼
                      offline_library.html (single-file artifact)
                                      │
         JWPUB import → ZIP → SQLite → decrypt → sanitise → IndexedDB → reader/notes/backup
```

## 2. Module responsibilities

| File | Responsibility |
|---|---|
| `00-core-db.js` | Global state, version constants, i18n, diagnostics, crypto, HTML sanitising, IndexedDB open, book persistence/migration |
| `01-importer-security.js` | ZIP magic checks, damaged-ZIP repair, JWPUB/SQLite parsing, document decoding and import tolerance |
| `02-publication-catalog.js` | Category rules, cards, section home pages, custom categories, note editor |
| `03-reader-links.js` | Reader, search, highlights, footnotes/concordance, `jwpub://` link routing |
| `04-navigation-history.js` | Import dialog, navigation, back stack, sidebar, page turning, event wiring, language-pack input |
| `05-backup-startup.js` | Backup/restore, Blob packing, startup, About dialog |

These files are **not ES modules**. They are concatenated into one `<script>` and share top-level variables and functions (global state at the start of `00-core-db.js`; startup IIFE at the end of `05-backup-startup.js`). The order comes from `project.json` → `modules.order` and must not be changed casually.

## 3. Startup

At the end of `05-backup-startup.js`:

```text
applyI18n()
  → openDB()
  → ensureMigrated()
  → ensureCategoryIds()
  → renderBooks()
```

Failure shows "local storage unavailable". DB name/version come from `project.json`: `OfflineJwLibrary` v5.

## 4. Data layer

### 4.1 Stores

`openDB()` creates 13 object stores:

| Store | Purpose |
|---|---|
| `books` | Lightweight book index |
| `bookMeta` | Book metadata including generation |
| `bookDocs` | Document bodies |
| `bookAssets` | Images/fonts/assets |
| `bookAux` | Auxiliary data and import reports |
| `bookSources` | Optional original SQLite, inner files and manifest for JWPUB export |
| `notes` | Notes |
| `bookmarks` | Bookmarks |
| `history` | Reading history |
| `system` | Migration flags, canonical anchor cache |
| `categories` | Categories |
| `tags` | Tags |
| `highlights` | Highlights |

### 4.2 Metadata + split stores + generations

- `buildBookMeta()` builds light metadata;
- `persistBook()` splits documents, assets and auxiliary data into separate stores;
- `loadBook()` reassembles a book by `gen`;
- after a successful re-import, `purgeOldGenerations()` deletes the old `gen` data.

This preserves the previous version on failure while preventing unbounded asset accumulation.

### 4.3 Stable IDs

Legacy IDs looked like `lang_symbol_year[_issue]`, so notes drifted when a publication got a new year. `legacyIdFor()` / `keySymbolFor()` / `idFor()` now create stable IDs. Restoring old backups uses `buildRestoreIdMap()` and `remapUserDataIds()` to remap notes, highlights, bookmarks and history.

`ensureCanonicalAnchors()` provides cross-language highlight anchors; the cache is invalidated and rebuilt after restore.

## 5. Import pipeline

1. `fileToBytes()` reads bytes; `zipHasEocd()` / `zipHasLocalHeader()` validate; `rebuildZipFromLocalHeaders()` repairs ZIPs missing a central directory.
2. JSZip opens the archive, reads `manifest.json` and any inner `contents` ZIP.
3. sql-wasm reads SQLite and parses `Document`, `BibleVerse`, `Hyperlink`, `Extract`, `Commentary`, `DatedText`, etc.
4. `keyIv()` derives key/iv from `lang_symbol_year[issue]`; `decryptContentAny()` tries `aes+zlib`, `aes+raw`, `plain+zlib`, `plain+raw`, `plain-text`.
5. TOC, `bibleStructure`, dated-text documents and assets are generated.
6. `persistBook()` writes IndexedDB and produces an import report.

Limits at the top of `01-importer-security.js`: 380 MB per file, 8000 internal files, 48 MB per document, failure ratio 0.6.

## 6. Reader and security boundary

### 6.1 Reader state and interface

- The header is now back button, a two-line title (publication + current chapter/article) and a three-dot menu; TOC, search, paging, bookmark, notes, language version, pronunciation and font size live in that menu, and the old bottom action bar is gone.
- `sectionViews` and `sectionPageHistory` are stored in the `readerPanelCache` record of the IndexedDB `system` store, isolated per tab. Startup calls `loadReaderCache()` before rendering and resumes the last tab and paragraph.
- A link popover title is clickable and calls `openPublicationDocument()` to open the target paragraph; `openDocInBook()` pushes the current article into the current tab's back history.
- Offline warnings inside a popover use `#modal`, layered above the link popover; dismissing a warning does not trigger the popover's outside-click close.
- Gutter pencil markers and the active verse/paragraph block highlight are CSS-only. `showHighlightOutline()` merges the active highlight into one absolutely positioned rounded box per visual line.

`cleanHtml()` (`00-core-db.js`) sanitises article HTML before insertion:

- removes `script`, `iframe`, `object`, `embed`, `base`, `meta[http-equiv]`, remote `<link>` and remote images;
- replaces `video` / `audio` with an offline notice;
- strips `on*` attributes, `srcdoc` and `javascript:` URLs;
- rewrites inline CSS `url()`, turning remote addresses into `none`;
- converts `jwpub://...` to `data.jwlink` and external links to `data.externalLink`;
- removes `src` / `href` from unmapped resources.

`cleanHtml()` is currently a **blacklist** and the codebase uses `innerHTML` widely. Known priority issues: `titleRich` / `subtitleRich` inserted directly in `03-reader-links.js`, and highlight colours inserted into a `style` attribute. See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), P0.

## 7. Diagnostics API

`window.__offlineLibrary` exposes:

| Member | Purpose |
|---|---|
| `version` | App version |
| `cryptoMode` | `webcrypto` or `js-fallback` |
| `diagnostics()` | Version, storage usage, book summaries, import reports, recent events |
| `cleanOldGenerations()` | Clean old generations |
| `pinyinDebug()` | Pronunciation debug info |
| `registerLanguagePack()` | Register a language pack |
| `setUiLanguage()` | Switch UI language |
| `events()` | Recent diagnostic events |

This is a diagnostics interface, **not a plugin API** — no permissions, subscriptions or sandbox. See [PLUGINS.md](PLUGINS.md).

## 8. Explicit non-goals

- No server, account or sync;
- No Service Worker / PWA cache;
- No business `fetch` / XHR / WebSocket;
- No runtime plugin loading;
- Audio/video are not stored — an offline notice is shown;
- JWPUB origin/signature is not verified; key derivation is for format compatibility, not confidentiality.
