# 安全策略 / Security policy

[English](#security-policy-en) · [简体中文](#安全策略-zh)

<a id="安全策略-zh"></a>
## 安全策略（中文）

### 支持范围

当前仅对最新发布的 `2.1.x` 提供安全修复。旧版本请升级后再报告。

### 如何报告

**请勿在公开 Issue 中提交漏洞细节或恶意样本。** 请使用以下方式之一：

- GitHub 仓库的 **Security → Report a vulnerability**（私有安全公告）；
- 通过 GitHub 私信联系维护者 `Cheng-Ethan`。

报告请包含：

1. 影响版本与构建产物；
2. 复现步骤或最小样本（不要上传真实个人资料）；
3. 预期行为与实际行为；
4. 可能的修复建议。

维护者会尽快确认，目标响应时间：3 个工作日内初答复，7 个工作日内给出修复计划。

### 隐私说明

- 应用不联网、不上传、不遥测；
- 默认情况下，笔记、高亮、书签、历史以明文存于本地 IndexedDB；启用「应用锁」后这些字段、原始文件名、原始包和备份都会加密，但书名、目录、标注位置等元数据仍是明文；
- 未启用应用锁时，导出的备份 JSON 未加密，含书目与笔记，请妥善保存；启用后输出加密的 `.olvault`；
- `diagnostics()` 输出会包含存储用量、出版物标题与最近事件，分享前请脱敏。

### 已知关注面（持续修复中）

- 导入的 JWPUB 属于不可信输入；
- `cleanHtml()` 当前为黑名单模型；
- 富文本标题和高亮颜色的注入面已列入 P0 修复；
- JSZip / pako / sql.js 在主上下文解析不可信数据，依赖漏洞需及时跟进。

---

<a id="security-policy-en"></a>
## Security policy (English)

### Supported versions

Security fixes are provided for the latest `2.1.x` release only. Please upgrade before reporting issues against older versions.

### Reporting

**Do not file public issues with vulnerability details or malicious samples.** Use one of:

- **Security → Report a vulnerability** in the GitHub repository (private advisory);
- contact maintainer `Cheng-Ethan` privately via GitHub.

Include:

1. affected version and artifact;
2. reproduction steps or a minimal sample (no real personal data);
3. expected vs actual behaviour;
4. possible fix suggestion.

Target response: acknowledgement within 3 business days, fix plan within 7 business days.

### Privacy notes

- The app makes no network calls, uploads or telemetry;
- by default notes, highlights, bookmarks and history are stored unencrypted in local IndexedDB; with the **app lock** on, those fields, original file names, original packages and backups are encrypted, while titles, table of contents and annotation positions remain plaintext;
- without the lock, exported backup JSON is unencrypted and contains titles and notes — store it carefully; with the lock, backups are encrypted `.olvault` files;
- `diagnostics()` includes storage usage, book titles and recent events; redact before sharing.

### Known areas under active work

- Imported JWPUB files are untrusted input;
- `cleanHtml()` is currently a blacklist sanitiser;
- rich-title and highlight-colour injection are P0 fixes;
- JSZip / pako / sql.js parse untrusted data in the main context, so dependency advisories matter.
