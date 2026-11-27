# 备份格式 / Backup format

[English](../en/dev/BACKUP_FORMAT.md) · [使用指南](../user/USAGE.md)

## 1. 格式标识

| 标识 | 方向 | 说明 |
|---|---|---|
| `offline-library-library-v2` | 导出 + 恢复 | 当前完整备份格式，每本可带原始包 |
| `offline-library-library-v1` | 仅恢复 | 旧完整备份格式，不含原始包 |
| `offline-library-notes-v1` | 导出 + 恢复 | 当前笔记备份格式 |
| `offline-library-backup-v1` | 仅恢复 | 历史完整备份 |
| `offline-library-backup-v2` | 仅恢复 | 历史完整备份，含二进制打包 |
| `offline-library-backup-v3` | 仅恢复 | 历史完整备份 |

导出文件均为 `application/json`。完整备份文件名固定为 `offline-library-library-v2.json`，笔记备份为 `offline-library-notes-v1.json`。

## 2. 笔记备份

```json
{
  "format": "offline-library-notes-v1",
  "appVersion": "2.0.0",
  "createdAt": "2026-11-24T00:00:00.000Z",
  "notes": [],
  "tags": [],
  "highlights": []
}
```

恢复时只接受该格式，且会直接写回 `notes` / `tags` / `highlights` store，然后刷新规范锚点。

## 3. 完整备份

顶层结构（由 `backupLibrary()` 流式写出）：

```json
{
  "format": "offline-library-library-v2",
  "appVersion": "2.0.0",
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

每本 `book` 是 `loadBook(id, { assets: true })` 的结果，包含元数据、文档、资源与导入报告等。

`system` 保存非派生的系统记录（主要是 `readerPanelCache`，即各栏目当前文章、返回历史和段落位置）；`canonicalAnchorsV1`、迁移标记等派生记录不写入，恢复后重建。`localStorage` 保存所有 `offlineLibrary*` 键，包括界面语言、内容语言、拼音、侧栏/目录状态、语言包、搜索历史/所选出版物、圣经顺序、保留原始包和 source-first 设置。恢复时会写回并立即应用。

### 3.0 原始包

v2 在每本 `book` 上增加可选字段 `__source`，内容为 `OfflineJwLibrarySources` 中该书的记录（`name`、`size`、`jwpub` Blob 或旧版 `innerZip` / `manifestBytes` / `db` / `files`）。导出时：

- 有原始包的书会把完整原始 `.jwpub` 一并写入，备份因此可能接近图书馆体积的两倍；
- 没有原始包的书照常导出，`__source` 省略；
- 恢复 v2 时先 `persistBook()`，再 `saveBookSource()`；恢复 v1 时保留设备上已有的原始包。

### 3.1 二进制包装

`writePackedValue()` 会把非 JSON 原生类型编码成带标记的对象：

```json
{ "__offlineType": "Blob", "mime": "image/png", "data": "<base64>" }
{ "__offlineType": "ArrayBuffer", "data": "<base64>" }
{ "__offlineType": "Uint8Array", "data": "<base64>" }
```

`unpackValue()` 按 `__offlineType` 还原为 `Blob` / `ArrayBuffer` / TypedArray。`undefined`、函数、symbol 会被跳过；非有限数字写成 `null`。

导出不是一次性 `JSON.stringify`：它用 `createJsonSink()` 按约 1 MB 文本块生成 Blob part，避免移动端一次性把数百 MB Base64 字符串放进内存。

## 4. 恢复流程

```text
选择文件
  → 读取头部/流式识别 format
  → 格式白名单校验
  → 逐本 unpackValue()
  → buildRestoreIdMap() 重映射旧 ID
  → persistBook() 写入
  → 如有 __source，saveBookSource() 写入原始包
  → unpack 尾部 notes/tags/highlights/bookmarks/history/categories
  → remapUserDataIds()
  → 写回各 store
  → 删除并重建 canonicalAnchors
  → renderBooks()
```

要点：

- 完整恢复使用 `file.stream()`；不支持的浏览器会报错。
- 恢复是**按 ID 覆盖/合并**，不是清空后导入。
- 恢复不是原子事务；失败可能留下部分数据。
- 每次恢复后都会刷新规范锚点，保证跨语言高亮定位一致。

## 5. ID 重映射

旧备份中的书籍 ID 可能来自 `lang_symbol_year[_issue]`。恢复时：

1. `buildRestoreIdMap()` 对每本书计算 `idFor()`，建立 `旧 ID → 稳定 ID`；
2. `remapUserDataIds()` 重映射：
   - `notes.bookId`、`notes.id` 中形如 `answer:<bookId>:` 或 `<bookId>:` 的前缀；
   - `highlights.bookId`、`highlights.noteId`；
   - `bookmarks.id`、`bookmarks.bookId`；
   - `history.id`、`history.bookId`。
3. 笔记 ID 映射表再用于高亮的 `noteId`，保持引用完整。

## 6. 兼容性规则（给未来改动）

- 新增字段：允许，恢复端必须忽略未知字段。
- 改变字段语义：必须提升格式版本，例如 `offline-library-library-v2`。
- 改变二进制包装：必须新增 `__offlineType`，不能复用旧值表达新含义。
- 改变稳定 ID 算法：必须同时提供旧 → 新映射，否则历史笔记会错位。
- 任何格式变更都要更新本文件和 [CHANGELOG.md](../../CHANGELOG.md)。

## 7. 用户注意事项

- 备份 JSON **未加密**，包含书目、笔记、可能的导入报告以及（v2）原始 PUB 包。
- v2 备份可以恢复到 2.0 及以后版本；1.0.0 只能恢复 v1 备份，不识别 `__source`。
- 大备份导出会显示进度；超过 150 MB 需确认。含原始包的备份体积接近图书馆的两倍。
- Base64 会让文件比 IndexedDB 中的实际体积大约 1/3。
- 升级或换 Sitecase 项目前务必导出备份，并保留旧项目直到验证完成。
