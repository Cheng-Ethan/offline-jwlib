# Backup format

[简体中文](../../dev/BACKUP_FORMAT.md) · [Usage](../user/USAGE.md)

## 1. Format identifiers

| Identifier | Direction | Notes |
|---|---|---|
| `offline-library-library-v1` | export + restore | Current full backup |
| `offline-library-notes-v1` | export + restore | Current notes backup |
| `offline-library-backup-v1` | restore only | Legacy full backup |
| `offline-library-backup-v2` | restore only | Legacy full backup with binary packing |
| `offline-library-backup-v3` | restore only | Legacy full backup |

Exports are `application/json`. Filenames are fixed to `offline-library-library-v1.json` or `offline-library-notes-v1.json`.

## 2. Notes backup

```json
{
  "format": "offline-library-notes-v1",
  "appVersion": "0.14.0",
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
  "format": "offline-library-library-v1",
  "appVersion": "0.14.0",
  "createdAt": "2026-11-24T00:00:00.000Z",
  "books": [ "<packed book>" ],
  "notes": [ "<packed notes>" ],
  "tags": [],
  "highlights": [],
  "bookmarks": [],
  "history": [],
  "categories": []
}
```

Each `book` comes from `loadBook(id, { assets: true })`, including metadata, documents, assets, raw SQLite and the import report.

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

- Backup JSON is **not encrypted**; it contains book titles, notes and possibly import reports.
- Large exports show progress; above 150 MB a confirmation is required.
- Base64 makes the file roughly one third larger than the stored data.
- Always export before upgrading or switching Sitecase projects, and keep the old project until verification succeeds.
