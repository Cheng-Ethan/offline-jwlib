# Release process

[简体中文](../../dev/RELEASING.md) · [Installation](../user/INSTALL.md)

## 1. Versioning

Use `major.minor.patch` (currently `2.1.0`):

- `patch`: fixes, docs, build scripts;
- `minor`: new features, extension points, backward-compatible backup fields;
- `major`: breaking changes to backup format, module API or data structures.

`appVersion` in `project.json` is the single source of truth. Keep in sync:

- version constant in `src/modules/00-core-db.js`;
- `CHANGELOG.md`;
- `README.md` / `README.en.md`;
- HTML meta (injected by the build).

## 2. Pre-release checklist

1. Complete the [TESTING.md](TESTING.md) matrix and acceptance criteria.
2. Confirm a clean `git status` and the intended release branch.
3. Build with both Windows PowerShell and Node (see [../user/INSTALL.md](../user/INSTALL.md)).
4. Verify:
   - SHA-256 of `offline_library.html` and `dist/offline_library.html` match;
   - no `@@...@@` placeholders remain;
   - version agrees in all three places.
5. Handle `_cf` files: exclude from this release unless their purpose is documented.
6. Generate `SHA256SUMS.txt` and publish it with the HTML and source archive.
7. Write additions, fixes, known issues and upgrade notes in CHANGELOG.

## 3. Release artifacts

Publish:

- `offline_library.html` (primary artifact)
- `SHA256SUMS.txt`
- source archive (GitHub-generated is fine)

Do not publish:

- `offline_library_cf.html` (purpose undocumented)
- `rollback/*.html` (development intermediates)
- directories containing personal JWPUB samples

## 4. Upgrade notice template

> Export a full backup and keep the old HTML/Sitecase project before upgrading. A new version may upgrade the IndexedDB schema; rolling back the HTML does not roll back data.

## 5. Post-release

- Attach checksums to the GitHub Release;
- verify documentation links;
- collect Sitecase on-device feedback;
- for P0 regressions, ship a patch immediately and mark it in CHANGELOG.
