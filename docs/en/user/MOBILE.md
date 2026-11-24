# Using it on mobile / Mobile guide

[简体中文](../../user/MOBILE.md) · [Install](INSTALL.md) · [Usage](USAGE.md)

On a phone you are not opening a "web app" — you are opening **one local HTML file**. The browser or container app must allow that file to read/write local storage, or books and notes will not persist. The steps below are concrete but should always be verified on your own device with a sample JWPUB before importing real material.

## 1. iPhone / iPad

### Recommended: Sitecase

Sitecase can import a local HTML file as a project and is the closest match to the target environment.

1. Export a full backup from the old project: **More → Backup & restore → Backup library**.
2. Copy `offline_library.html` to the phone (Files app / AirDrop / cloud drive).
3. Create a new project in Sitecase and import that HTML.
4. Open the new project and use **More → Backup & restore → Restore library** with the backup.
5. Verify TOC, article text, images, notes, bookmarks and history.
6. Delete the old project only after verification.

Notes:

- different HTML projects may use isolated local data spaces; a new project will not automatically see old books;
- Sitecase's file picker and storage-persistence behaviour must be confirmed on your device;
- copying only the HTML without restoring the backup leaves the new project empty.

### Alternatives

Other container apps that import local HTML **and allow WebView local storage** can work, but must pass the import → read → backup → restore check. Opening `file://` directly in Safari is generally not suitable for long-term storage.

## 2. Android phone / tablet

### Option A (recommended): local HTTP server

Run a tiny local server so the HTML has a stable origin and avoids `file://` storage restrictions.

Example with Termux:

1. Install Termux and Python:

   ```sh
   pkg update
   pkg install python
   ```

2. Put `offline_library.html` in device storage, e.g. `/sdcard/Download/`.
3. Start the server in Termux:

   ```sh
   cd /sdcard/Download
   python3 -m http.server 8080 --bind 127.0.0.1
   ```

4. Open in Chrome / Edge:

   ```text
   http://127.0.0.1:8080/offline_library.html
   ```

5. After verifying import, images, backup and restore, add the address to the home screen if your browser supports it.

Benefits: the browser treats the HTML as a normal site, so local data behaviour is closer to desktop Chrome. The server binds only to `127.0.0.1` and is not exposed to the network. Still verify on your exact device/browser combination.

### Option B: WebView / HTML Viewer container

Choose an app that opens local HTML **and allows local storage**:

1. Put the HTML in device storage;
2. open it with the app and grant file/storage permissions;
3. immediately run: import sample → close app → reopen → is the book still there?
4. then verify full backup/restore;
5. only import real material once persistence is confirmed.

These apps vary widely: some treat every file as its own origin, some clear caches, some cannot handle large files. "It opens" is not enough — "it persists after restart" is the requirement.

### Not recommended: direct `file://`

Some Android browsers restrict local data for `file://` or treat each file as a separate origin, so books may disappear next time. If you must try, back up first and accept possible data loss.

## 3. Mobile usage tips

- Prefer smaller JWPUB files; for very large ones, import in desktop Chrome first, then back up and restore to the phone.
- Export a full backup before every upgrade and keep the old app project.
- Images and complex layouts depend most on real-device verification; record device, app version and publication sample when reporting issues.
- The app never goes online; blocked external links are expected behaviour.

If it will not open or data disappears, check the [FAQ](FAQ.md), then the [mobile test matrix](../dev/TESTING.md).
