# Backup format

[简体中文](../../dev/BACKUP_FORMAT.md) · [Usage](../user/USAGE.md)

## 1. Format identifiers

| Identifier | Direction | Notes |
|---|---|---|
| `offline-library-library-v2` | export + restore | Current full backup, each book may carry its original package |
| `offline-library-library-v1` | restore only | Legacy full backup without original packages |
| `offline-library-notes-v1` | export + restore | Current notes backup |
| `offline-library-backup-v1` | restore only | Legacy full backup |
| `offline-library-backup-v2` | restore only | Legacy full backup with binary packing |
| `offline-library-backup-v3` | restore only | Legacy full backup |

Exports are `application/json`. The full backup filename is fixed to `offline-library-library-v2.json`; the notes backup uses `offline-library-notes-v1.json`.

## 2. Notes backup

```json
{
  "format": "offline-library-notes-v1",
  "appVersion": "2.0.1",
  "createdAt": "2026-11-24T00:00:00.000Z",
  "notes": [],
  "tags": [],
  "highlights": []
}
```

Restore accepts only this format, writes back to `notes` / `tags` / `highlights`, then refreshes canonical anchors.

## 3. Full backup

Top-level structure (streamed by `backupLibrary()`):

```json
{
  "format": "offline-library-library-v2",
  "appVersion": "2.0.1",
  "createdAt": "2026-11-24T00:00:00.000Z",
  "books": [ "<packed book>" ],
  "notes": [ "<packed notes>" ],
  "tags": [],
  "highlights": [],
  "bookmarks": [],
  "history": [],
  "categories": [],
  "system": [],
  "localStorage": {}
}
```

Each `book` comes from `loadBook(id, { assets: true })`, including metadata, documents, assets and the import report.

`system` stores non-derived system records (mainly `readerPanelCache`: per-section current article, back history and paragraph position); derived records such as `canonicalAnchorsV1` and migration flags are omitted and rebuilt after restore. `localStorage` stores every `offlineLibrary*` key: UI language, content language, pronunciation, sidebar/TOC state, language packs, search history/selected books, Bible order, source retention and source-first settings. Restore writes them back and applies them immediately.

### 3.0 Original packages

v2 adds an optional `__source` field to each `book`, holding the `OfflineJwLibrarySources` record for that book (`name`, `size`, `jwpub` Blob or the legacy `innerZip` / `manifestBytes` / `db` / `files`). On export:

- books with a stored package include the complete original `.jwpub`, so the backup can approach twice the library size;
- books without one simply omit `__source`;
- restoring v2 calls `persistBook()` and then `saveBookSource()`; restoring v1 leaves any package already on the device untouched.

### 3.1 Binary packing

`writePackedValue()` encodes non-native JSON types as tagged objects:

```json
{ "__offlineType": "Blob", "mime": "image/png", "data": "<base64>" }
{ "__offlineType": "ArrayBuffer", "data": "<base64>" }
{ "__offlineType": "Uint8Array", "data": "<base64>" }
```

`unpackValue()` restores them to `Blob` / `ArrayBuffer` / TypedArray by `__offlineType`. `undefined`, functions and symbols are skipped; non-finite numbers become `null`.

Export is not one `JSON.stringify`: `createJsonSink()` emits Blob parts in ~1 MB text chunks, so mobile devices do not hold hundreds of MB of Base64 strings in memory.

## 4. Restore flow

```text
pick file
  → detect format from head / stream
  → whitelist validation
  → unpackValue() per book
  → buildRestoreIdMap() remaps legacy IDs
  → persistBook()
  → if __source exists, saveBookSource()
  → unpack tail notes/tags/highlights/bookmarks/history/categories
  → remapUserDataIds()
  → write stores
  → invalidate and rebuild canonicalAnchors
  → renderBooks()
```

Notes:

- full restore uses `file.stream()`; unsupported browsers error out;
- restore merges/overwrites by ID, it does not clear first;
- restore is not atomic — a failure can leave partial data;
- canonical anchors are refreshed after every restore for cross-language highlights.

## 5. ID remapping

Legacy book IDs may be `lang_symbol_year[_issue]`. During restore:

1. `buildRestoreIdMap()` computes `idFor()` per book and builds `old ID → stable ID`;
2. `remapUserDataIds()` remaps:
   - `notes.bookId`, and `notes.id` prefixes like `answer:<bookId>:` or `<bookId>:`;
   - `highlights.bookId`, `highlights.noteId`;
   - `bookmarks.id`, `bookmarks.bookId`;
   - `history.id`, `history.bookId`.
3. The note-ID map is then applied to highlight `noteId` references.

## 6. Compatibility rules for future changes

- Adding fields: allowed; restore must ignore unknown fields.
- Changing field semantics: bump the format version, e.g. `offline-library-library-v2`.
- Changing binary packing: add a new `__offlineType`; never reuse an old value with new meaning.
- Changing the stable-ID algorithm: always ship old → new mapping or history notes will drift.
- Update this file and [CHANGELOG.md](../../../CHANGELOG.md) for every format change.

## 7. User notes

- Backup JSON is **not encrypted**; it contains book titles, notes, possibly import reports and (v2) the original PUB packages.
- v2 backups restore into 2.0 and later; 1.0.0 can only restore v1 backups and ignores `__source`.
- Large exports show progress; above 150 MB a confirmation is required. Backups with original packages approach twice the library size.
- Base64 makes the file roughly one third larger than the stored data.
- Always export before upgrading or switching Sitecase projects, and keep the old project until verification succeeds.
