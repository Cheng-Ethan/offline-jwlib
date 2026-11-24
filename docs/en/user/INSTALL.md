# Install on your device

[简体中文](../../user/INSTALL.md) · [Usage](USAGE.md) · [Mobile guide](MOBILE.md) · [English README](../../../README.en.md)

## You do not need to build

End users need **no** Node.js, PowerShell, npm or network access. All you need is one `offline_library.html` file — download it from a release or get it from a developer.

> Developer build instructions live in [docs/en/dev/BUILD.md](../dev/BUILD.md); users can skip them.

## 1. Desktop (Windows / macOS / Linux)

1. Put `offline_library.html` in any folder.
2. Double-click it, or open it with a browser.
3. A Chromium-based browser (Chrome / Edge) is recommended.
4. Click **Import PUB** and choose your `.jwpub` / `.pub` files.

If the browser says "local storage unavailable", try another modern browser with local storage support. Do not open it from a cloud-sync folder that rewrites files.

## 2. iPhone / iPad

Use a local-HTML container app such as **Sitecase**:

1. Export a full backup from the old project (**More → Backup library**).
2. Import `offline_library.html` as a new project in Sitecase.
3. Restore the backup with **Restore full library**.
4. Verify reading, images, notes and history before deleting the old project.

> Different HTML projects may use isolated local databases. Do not assume a new HTML file inherits old data. See the [mobile guide](MOBILE.md).

## 3. Android phone / tablet

Opening directly via `file://` is not recommended — some browsers disable local databases. See the [mobile guide](MOBILE.md): a local HTTP server is the most reliable path; a WebView container works too but needs on-device verification.

## 4. Upgrade and backup

Before every upgrade:

1. Export a full backup;
2. keep the old HTML and old project;
3. open/import the new HTML;
4. restore the backup and verify;
5. only then clean up the old version.

Replacing the HTML **does not roll back data**. If a new version migrated the local database, the old HTML may not read the new data.

## 5. Next steps

- [Usage](USAGE.md): import, reading, notes, backup, language packs
- [Mobile guide](MOBILE.md): concrete iPhone / Android steps
- [FAQ](FAQ.md): common questions

Data stays on your device and the app does not go online. Always back up before upgrading or switching devices.
