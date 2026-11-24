# FAQ

[简体中文](../../user/FAQ.md) · [Usage](USAGE.md) · [Mobile guide](MOBILE.md)

## Does the app access the network?

It makes no business requests. There are no accounts, telemetry or external scripts; remote images and styles are stripped while reading, and external link clicks are intercepted with a notice. All dependencies are bundled into the same HTML, so normal use needs no network.

## Where are my books and notes?

Everything stays in the local data of your current browser or app:

- publications, images, notes, bookmarks, highlights, tags, history and categories;
- UI language, pronunciation and language-pack preferences.

There is no server and no account. Clearing browser/app data deletes this content, so export backups regularly.

## Why are books missing after an upgrade?

Different HTML projects may use isolated local data spaces. A new HTML file does not automatically inherit books from an old project. Export a full backup from the old project → open the new HTML → restore the backup → delete the old project only after verification.

## How large can a JWPUB be?

Aim for under 380 MB per file, 8000 internal files and 48 MB per document. Low-end phones can still fail from memory pressure. For large files, import in desktop Chrome first, then migrate with a backup.

## What about video and audio?

They are not stored; articles show an offline placeholder. This keeps the build small and offline.

## Are `jwpub://c/` commentary links guaranteed to work?

The app tries to match commentary data locally, but available samples lack publications with these links, so the real address format still needs verification. Unmatched links explain the reason and **never go online**.

## How do I switch the interface language?

Use the language button in the top bar. You can also import your own language JSON file; see [Usage](USAGE.md#6-language-and-categories). This is a **user language pack (plugin v0)**: UI strings only, no code execution and no access to your books.

## Can I customise categories?

Yes. Use a publication card's ⋯ menu to create categories or move books. Custom categories stay on your device and do not change built-in rules.

## Is the backup secure?

Backup JSON is **not encrypted** and contains book titles and your notes. Avoid exporting or storing backups on shared computers. Always back up before upgrading or switching devices.

## What is the licence?

[MIT](../../../LICENSE). Bundled dependencies are listed in [third-party notices](../../../THIRD_PARTY_NOTICES.md). JWPUB files remain the property of their rights holders; import only material you are entitled to use.
