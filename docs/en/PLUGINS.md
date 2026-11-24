# Plugins & extension points

[简体中文](../PLUGINS.md) · [Architecture](ARCHITECTURE.md)

## 1. Current state (important)

**There is no formal plugin system in the current version.**

There is no plugin manifest, registry, lifecycle, permission model, hook bus or sandbox. No `plugin`-related implementation exists in the source. Do not mistake the following for plugin APIs:

- `window.__CATEGORY_CONFIG__`: build-time category rule data;
- `registerLanguagePack()`: language-pack registration;
- `window.__offlineLibrary`: diagnostics/debug interface;
- custom categories in the UI: user data, not code extensions.

This document first records the **existing extension points**, then proposes a **plugin architecture**. The latter is a roadmap item, not shipped functionality.

## 2. Existing extension points

| Extension point | Location | Type | Runtime-changeable |
|---|---|---|---|
| Category rules | `src/categories.json` → `window.__CATEGORY_CONFIG__` | Build-time JSON | No; rebuild required |
| Custom categories | IndexedDB `categories` store; UI in `02-publication-catalog.js` | User data | Yes |
| Language packs | `registerLanguagePack()`, `00-core-db.js` | Runtime registration + localStorage | Yes |
| UI language | `setUiLang()` / language button | Runtime setting | Yes |
| Content language | Reader language menu | Runtime setting | Yes |
| Diagnostics API | `window.__offlineLibrary` | Read-only/debug | No |

## 3. Category rule format

`src/categories.json`:

```json
{
  "version": 1,
  "rules": [
    {
      "id": "magazine-awake",
      "priority": 40,
      "category": "magazines.awake",
      "match": {
        "uniqueEnglishSymbol": ["^g\\d", "^g$"],
        "symbol": ["^g\\d", "^g$"],
        "title": ["警醒", "awake"]
      }
    }
  ]
}
```

- `id`: unique rule id;
- `priority`: lower numbers win; rules are ordered by priority;
- `category`: output path, `.`-separated;
- `match`: field → regex/literal arrays. Supported fields include `symbol`, `uniqueEnglishSymbol`, `publicationCategorySymbol`, `categoryCodes`, `publicationType`, `title`, `categories`, `attributes`, `hasBible`, etc.;
- string arrays match on "any"; `hasBible: true` is a boolean condition.

`classifyPublication()` (`02-publication-catalog.js`) runs rules first and falls back to hardcoded logic. Changing rules requires rebuilding the HTML.

## 4. Language-pack format

See [USAGE.md](USAGE.md#6-language-and-categories) for a JSON example. Constraints:

- `code` / `lang`: `/^[a-z]{2,8}$/`;
- `messages` / `strings`: keys are original UI strings;
- persistence key: `offlineLibraryLanguagePacks`;
- UI language key: `offlineLibraryUiLang`.

This translates the app; it does **not** register code, intercept events or access book data.

## 5. `window.__offlineLibrary` API (diagnostics, not plugins)

```js
window.__offlineLibrary.version
window.__offlineLibrary.cryptoMode
window.__offlineLibrary.diagnostics()          // Promise<diagnostics>
window.__offlineLibrary.cleanOldGenerations()
window.__offlineLibrary.pinyinDebug()
window.__offlineLibrary.registerLanguagePack(code, meta, messages, persist?)
window.__offlineLibrary.setUiLanguage(code)
window.__offlineLibrary.events()
```

There is no `registerPlugin()`, permissions, error isolation or unload. Do not write plugins against this yet.

## 6. Proposed plugin architecture (planned, not implemented)

Principles: **stabilise the core API first; data-type extensions before code extensions; isolated by default, opt-in permissions.**

### 6.1 Manifest (proposed)

```json
{
  "id": "example.classifier",
  "name": "Example Classifier",
  "version": "1.0.0",
  "apiVersion": 1,
  "permissions": ["catalog.classify"],
  "entry": "plugin.js"
}
```

`apiVersion` is validated at build time; enable/disable state and order live in the `system` store.

### 6.2 Lifecycle (proposed)

```text
validate → install → activate → deactivate → uninstall
```

Core API:

```js
registerPlugin(manifest, impl)
activatePlugin(id)
deactivatePlugin(id)
listPlugins()
```

### 6.3 First extension points (suggested priority)

| Hook | Location | Risk | Notes |
|---|---|---|---|
| `catalog.classifyPublication` | `classifyPublication()` | Low | Joins the rule chain; returns a category or `null` |
| `language.pack` | `registerLanguagePack()` | Low | Formalises the existing pack mechanism |
| `reader.theme` | scoped CSS | Medium | Scoped CSS only; no DOM structure or core UI changes |
| `reader.routeJwpubLink` | `routeJwpubLink()` | Medium | Resolver chain; falls through to built-in logic |
| `backup.migrate` | restore flow | High | Format migration hook with strict validation |

**Must not be exposed**: replacing `cleanHtml()`, or arbitrary scripts with direct access to `idb` / `currentBook` / `document.body`. Sanitising may only be extended through a whitelist of tags/attributes.

### 6.4 Isolation and permissions

- Prefer Web Worker or sandbox iframe + `postMessage`;
- deny `fetch`, XHR, WebSocket, `eval`, `new Function` by default;
- plugins receive a limited API facade, not the shared IIFE scope;
- per-plugin storage namespace `plugin:<id>:`;
- one plugin's exception must not break startup;
- external plugins require explicit user import and permission confirmation; offline use should verify a hash/signature.

### 6.5 Example (illustrative, not available today)

```js
export default {
  apiVersion: 1,
  activate(api) {
    api.catalog.addClassifier((book) => {
      if (book.symbol === 'CUSTOM') return 'custom.section';
      return null;
    });
  },
  deactivate() {}
};
```

## 7. Compatibility promises (proposed)

Before a plugin system lands, freeze these contracts to avoid future breakage:

1. `project.json` `moduleApiVersion` and `modules.order`;
2. `window.__CATEGORY_CONFIG__` `version` and `rules` shape;
3. language-pack fields and localStorage keys;
4. existing `window.__offlineLibrary` method signatures;
5. backup format identifiers (`offline-library-library-v1`, etc.).

Any breaking change should bump `moduleApiVersion` or the backup format version and be documented in [CHANGELOG.md](../../CHANGELOG.md).
