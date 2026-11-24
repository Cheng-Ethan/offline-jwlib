# 第三方声明 / Third-party notices

[English](#third-party-notices-en) · [简体中文](#第三方声明-zh)

本项目源码采用 [MIT](LICENSE) 许可证。以下第三方库被**完整内嵌**到单 HTML 产物中，运行时不作为外部依赖加载。

<a id="第三方声明-zh"></a>
## 第三方声明（中文）

| 组件 | 版本 | 许可证 | 来源 | 用途 |
|---|---|---|---|---|
| JSZip | 3.10.1 | MIT **或** GPLv3（本项目按 MIT 使用） | https://github.com/Stuk/jszip | ZIP 读取与修复 |
| pako | 未在 bundle 中标注 | MIT | https://github.com/nodeca/pako | zlib 解压回退 |
| sql.js / sql-wasm | 模板注明 1.15.0 inline build | MIT | https://github.com/sql-js/sql.js | 浏览器内 SQLite 读取 |

说明：

- JSZip 头信息见 `src/vendor/jszip.js:2-11`，其中声明 dual licence（MIT/GPLv3）并说明其使用 pako（MIT）。
- `src/index.template.html:167` 对 sql.js 的描述为 “1.15.0 inline build; recovered from the uploaded PDF and runtime-validated”。bundle 本身没有可机器读取的版本标记；发布前建议核实来源、许可证全文与哈希。
- pako bundle 未包含明确版本号，建议后续补齐版本台账与哈希。
- 各上游许可证全文请访问上表来源。若你分发本产物，请保留本声明与对应许可证。

### 待办

见 [DEVELOPMENT_PLAN.md](docs/dev/DEVELOPMENT_PLAN.md) P1-3：记录每个 vendor 的精确版本、许可证全文、来源 URL、SHA-256 与更新时间。

---

<a id="third-party-notices-en"></a>
## Third-party notices (English)

The project source is licensed under [MIT](LICENSE). The following libraries are **fully inlined** into the single HTML artifact and are not loaded as external runtime dependencies.

| Component | Version | Licence | Source | Use |
|---|---|---|---|---|
| JSZip | 3.10.1 | MIT **or** GPLv3 (used under MIT here) | https://github.com/Stuk/jszip | ZIP reading and repair |
| pako | not stamped in bundle | MIT | https://github.com/nodeca/pako | zlib decompression fallback |
| sql.js / sql-wasm | template notes a 1.15.0 inline build | MIT | https://github.com/sql-js/sql.js | In-browser SQLite reading |

Notes:

- The JSZip header at `src/vendor/jszip.js:2-11` declares dual licensing (MIT/GPLv3) and notes its use of pako (MIT).
- `src/index.template.html:167` describes sql.js as a "1.15.0 inline build; recovered from the uploaded PDF and runtime-validated". The bundle has no machine-readable version marker; verify provenance, licence text and hashes before release.
- The pako bundle does not expose a clear version; complete the ledger later.
- Full upstream licence texts are available at the source URLs above. If you redistribute the artifact, preserve this notice and the applicable licences.

### TODO

See [DEVELOPMENT_PLAN.md](docs/en/dev/DEVELOPMENT_PLAN.md) P1-3: record exact version, licence text, source URL, SHA-256 and updated-at for every vendor file.
