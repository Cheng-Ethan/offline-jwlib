# Usage

[简体中文](../../user/USAGE.md) · [Installation](INSTALL.md)

## 1. First run

1. Open `offline_library.html`.
2. Go to **More → Import PUB** (or use the main import button).
3. Select one or more `.jwpub` / `.pub` files. Batch import is supported.
4. Open material from the Bible / Publications / Daily Text / Meetings sections.

Import happens entirely locally: ZIP read (with repair for a missing central directory) → manifest → SQLite → decryption → document/asset extraction → saved on device. Large imports show per-book progress; a single failing document is isolated and only a high failure rate aborts the run.

## 2. The five sections

| Section | Content |
|---|---|
| Bible | JWPUB files with detected Bible data; book/chapter TOC |
| Publications | Browse by category, search, favourite, recategorise, delete |
| Daily Text | Date-based documents generated from `DatedText`; content comes from the publication |
| Meetings | Meeting workbooks, programs and convention material |
| More | Import, full/notes backup & restore, recent reads, bookmarks, notes, language packs, About |

Categories are derived from `src/categories.json` rules matching publication symbols, types and titles. Source-code fallbacks apply when no rule matches. Users can also set custom categories from a card menu.

## 3. Reader

- TOC: drawer on mobile; three-pane layout at ≥1100px (nav / TOC / article).
- Font size and pronunciation controls in the reader toolbar.
- Swipe/button page turning with restored scroll position.
- Search within the current book, all publications or the Bible; recent searches and "return to results" are supported.
- Internal links: `jwpub://p/` (publication), `jwpub://b/` (Bible) and `jwpub://c/` (commentary) resolve locally; unresolved links explain the reason and **never go online**.
- External links show a "will not open online" notice.
- Remote images/CSS are stripped when sanitising article HTML.

## 4. Notes, highlights and bookmarks

- Select text in the article to open the annotation toolbar and create a highlight. Highlights use block index + offsets and stay aligned across language/year changes via stable IDs.
- The collapsible note editor supports undo/redo; verse notes can be saved per verse.
- Tags organise notes and highlights.
- Bookmarks save reading positions.
- History keeps recent reads and scroll positions.

> This data is stored unencrypted on your device. Backup JSON is unencrypted too; avoid exporting sensitive data on shared devices.

## 5. Backup and restore

### Export

In **More**:

- **Backup library** → `offline-library-library-v1.json`: all publications, raw SQLite, assets, notes, tags, highlights, bookmarks, history and categories.
- **Backup notes** → `offline-library-notes-v1.json`: notes, tags and highlights only.

A confirmation appears above roughly 150 MB. The actual file is larger than the estimate because of Base64 encoding.

### Restore

- Full library: accepts `offline-library-backup-v1/v2/v3` and `offline-library-library-v1`; merges/overwrites by publication ID and remaps legacy IDs so notes stay aligned.
- Notes: only accepts `offline-library-notes-v1`.

Full-library restore uses `file.stream()`; unsupported browsers show an error — use desktop Chrome. Restore is not atomic, so back up current data first.

See [../dev/BACKUP_FORMAT.md](../dev/BACKUP_FORMAT.md).

## 6. Language and categories

### UI language

The language button switches built-in UI languages (Chinese/English/Japanese/Korean, etc.). UI language is separate from content language.

### Import a language pack

Import a local JSON file from **More**:

```json
{
  "code": "fr",
  "name": "Français",
  "locale": "fr-FR",
  "button": "FR",
  "messages": {
    "导入 PUB": "Importer PUB",
    "备份图书馆": "Sauvegarder la bibliothèque"
  }
}
```

- `code` or `lang`: required 2–8 letter lowercase language code;
- `messages` or `strings`: required dictionary keyed by original UI strings;
- `name` / `locale` / `button`: optional display metadata.

Packs persist in localStorage. You can also call `window.__offlineLibrary.registerLanguagePack(code, meta, messages)` from the console.

### Custom categories

Use a publication card's ⋯ menu to move or create categories. Custom categories stay on your device and do not alter built-in rules.

Rule format: [../dev/PLUGINS.md](../dev/PLUGINS.md).

## 7. Common issues

| Symptom | Action |
|---|---|
| "Local storage unavailable" | Use a modern browser with local storage; verify Sitecase container permissions |
| Import stalls/fails | Check the import report; skip a damaged file; try desktop Chrome |
| Images missing | Verify the source JWPUB contains assets; complex fonts/layouts need device testing |
| Books missing after upgrade | Export from the old project and restore in the new one |
| External links do not open | By design: the offline app never goes online |
| Large restore fails | Use a browser with `file.stream()`, or split backups |

See [FAQ.md](FAQ.md) and [../dev/TESTING.md](../dev/TESTING.md).
