# 插件与扩展 / Plugins & extension points

[English](../en/dev/PLUGINS.md) · [架构说明](ARCHITECTURE.md)

## 1. 当前状态（重要）

**当前版本没有代码插件系统，但已有数据型扩展（插件 v0）：用户语言包与分类规则。**

仓库中不存在插件清单、插件注册中心、生命周期、权限声明、钩子总线或沙箱，也没有可执行第三方代码的能力。现有扩展点如下：

- `window.__CATEGORY_CONFIG__`：构建期注入的分类规则数据；
- `registerLanguagePack()`：**用户语言包（插件 v0）**，运行时注册 UI 字符串；
- `window.__offlineLibrary`：诊断/调试接口，不是插件 API；
- UI 中的自定义分类：用户数据，不是代码扩展。

本节先如实记录**现有扩展点**，再给出**建议中的代码插件架构**。后者是规划，不是已实现功能。

## 2. 现有扩展点

| 扩展点 | 位置 | 类型 | 能否运行时修改 |
|---|---|---|---|
| 分类规则 | `src/categories.json` → `src/index.template.html` 的 `window.__CATEGORY_CONFIG__` | 构建期 JSON | 否，需重建 HTML |
| 自定义分类 | IndexedDB `categories` store，UI 在 `02-publication-catalog.js` | 用户数据 | 是 |
| 语言包 | `registerLanguagePack()`，`00-core-db.js` | 运行时注册 + localStorage 持久化 | 是 |
| 界面语言 | `setUiLang()` / 语言按钮 | 运行时设置 | 是 |
| 内容语言 | 阅读器语言菜单 | 运行时设置 | 是 |
| 诊断 API | `window.__offlineLibrary` | 只读/调试 | 否 |

## 3. 分类规则格式

`src/categories.json`：

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

字段说明：

- `id`：规则唯一标识；
- `priority`：匹配优先级（数值越小越优先，规则链按优先级排序）；
- `category`：输出分类路径，使用 `.` 分隔层级；
- `match`：字段 → 正则/字面值数组。支持的字段包括 `symbol`、`uniqueEnglishSymbol`、`publicationCategorySymbol`、`categoryCodes`、`publicationType`、`title`、`categories`、`attributes`、`hasBible` 等；
- 字符串数组按“任一命中”处理；`hasBible: true` 是布尔条件。

`classifyPublication()`（`02-publication-catalog.js`）先跑规则，未命中时用源码硬编码兜底。修改规则后必须重新构建 HTML。

## 4. 语言包格式（插件 v0）

见 [../user/USAGE.md](../user/USAGE.md#6-语言与分类) 的 JSON 示例。关键约束：

- `code` / `lang`：`/^[a-z]{2,8}$/`；
- `messages` / `strings`：键为应用内原始中文/英文 UI 文本；
- 持久化 key：`offlineLibraryLanguagePacks`；
- 界面语言 key：`offlineLibraryUiLang`。

这是**插件 v0（数据型扩展）**：用户可以自定义 JSON 并导入后获得自己的界面语言。它不能注册代码、拦截事件或访问出版物数据；完整的代码插件系统尚未实现。

## 5. `window.__offlineLibrary` API（诊断，非插件）

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

它不提供 `registerPlugin()`、权限、错误隔离或卸载能力。不要据此编写插件。

## 6. 建议中的插件架构（规划，未实现）

设计原则：**先稳定核心 API，再开放能力；先数据型扩展，再代码型扩展；默认隔离，显式授权。**

### 6.1 插件清单（提议）

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

构建期校验 `apiVersion`；运行时记录启用/禁用顺序与状态（存 `system` store）。

### 6.2 生命周期（提议）

```text
validate → install → activate → deactivate → uninstall
```

核心 API：

```js
registerPlugin(manifest, impl)
activatePlugin(id)
deactivatePlugin(id)
listPlugins()
```

### 6.3 首批扩展点（建议优先级）

| 扩展点 | 位置 | 风险 | 说明 |
|---|---|---|---|
| `catalog.classifyPublication` | `classifyPublication()` | 低 | 作为规则链的一部分，返回分类或 `null` |
| `language.pack` | `registerLanguagePack()` | 低 | 把现有语言包机制正式化 |
| `reader.theme` | `src/styles.css` 作用域注入 | 中 | 仅 scoped CSS，不允许改 DOM 结构或关键 UI |
| `reader.routeJwpubLink` | `routeJwpubLink()` | 中 | resolver 链，失败后继续内置逻辑 |
| `backup.migrate` | 恢复流程 | 高 | 格式迁移钩子，需严格校验 |

**不应开放**：直接替换 `cleanHtml()`、直接访问 `idb` / `currentBook` / `document.body` 的任意脚本执行。富文本清洗只能在白名单内增加标签/属性。

### 6.4 隔离与权限

- 优先用 Web Worker 或 sandbox iframe + `postMessage`；
- 默认禁止 `fetch`、XHR、WebSocket、`eval`、`new Function`；
- 插件只拿到受限 API facade，而不是共享 IIFE 作用域；
- 每个插件独立存储 namespace：`plugin:<id>:`；
- 单个插件异常不能阻断启动；
- 外部插件需用户显式导入并确认权限；离线场景建议使用哈希/签名校验。

### 6.5 示例（仅示意，当前不可用）

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

## 7. 兼容性承诺（建议）

在插件系统落地前，可以先行冻结以下契约，避免以后破坏：

1. `project.json` 的 `moduleApiVersion` 与 `modules.order`；
2. `window.__CATEGORY_CONFIG__` 的 `version` 与 `rules` 结构；
3. 语言包 JSON 字段与 localStorage key；
4. `window.__offlineLibrary` 现有方法签名；
5. 备份格式标识（`offline-library-library-v1` 等）。

任何破坏性变更都应提升 `moduleApiVersion` 或备份格式版本号，并在 [CHANGELOG.md](../../CHANGELOG.md) 中说明。
