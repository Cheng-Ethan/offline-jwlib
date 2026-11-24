# 开发计划 / Development plan

[English](../en/dev/DEVELOPMENT_PLAN.md) · [架构说明](ARCHITECTURE.md) · [测试与验证](TESTING.md)

> 基于 0.13.0 代码现状制定。原则：**先修安全与准确性，再稳工程与发布，最后开插件与重构。**

## 0. 当前基线

- 功能已成型：导入、五栏目、阅读器、标注、备份恢复均已实现。
- 文档严重滞后：历史文档停留在 0.4.0，代码已到 0.13.0。
- 构建与发布产物治理混乱：`_cf` 文件来源不明，`build.mjs` 与 `build.ps1` 行为不一致。
- 无自动化测试，Sitecase 真机未验证。
- 没有代码插件系统；已有数据型扩展（插件 v0）：用户语言包与分类规则。
- 当前本地开发工作区是通过 API 拉取文件初始化的**单提交快照**，与远端 Git 历史不一致（见 [BUILD.md](BUILD.md)）。

---

## P0 · 立刻处理（准确性与安全）

| # | 任务 | 验收标准 |
|---|---|---|
| P0-1 | 统一版本：补全 CHANGELOG 0.5–0.13；确认 README/验证记录版本提示 | 所有文档版本指向 0.13.0，历史文档标注为历史记录 |
| P0-2 | 修复富文本标题注入：`03-reader-links.js` 中 `titleRich` / `subtitleRich` 进入 DOM 前必须经 `cleanHtml()` 或降级为纯文本 | 恶意 PUB 中 `<img onerror>` / `<script>` 不执行，有回归用例 |
| P0-3 | 修复高亮颜色进入 `style` 属性的注入面：只允许白名单颜色值 | 非法颜色无法注入额外 CSS 声明 |
| P0-4 | 增加基础 CSP：禁止外部脚本/连接；允许当前必需的 inline script/style、data/blob 资源 | 离线功能不受影响，网络面板无外连 |
| P0-5 | 明确 `_cf` 产物：优先从发布流程排除，并在文档中说明历史来源 | 发布产物中不再出现未解释的 `_cf` 文件 |
| P0-6 | 修复本地 Git 历史：恢复 `github.com` 访问后 `git fetch origin`，以 `origin/main` 为基线重新接入；把本次文档提交 rebase/cherry-pick 过去 | `git log` 能看到远端历史；`git push` 不需要 force；当前文档改动保留 |
| P0-7 | 为 P0-2/P0-3 增加恶意样本测试 | 测试套件覆盖并全部通过 |

### P0-6 建议操作（网络恢复后）

```bash
cd offline_lib
git fetch origin
# 方案 A：保留工作区改动，重置到远端 main 基线
git branch backup-local-docs
git reset --soft origin/main
git commit -m "docs: add open-source documentation"

# 方案 B：若想完全跟随远端历史
git fetch origin
git rebase origin/main develop
```

执行前先备份当前工作区。修复完成前**不要**对远端执行 force push。

---

## P1 · 工程稳定与发布能力（1–2 个迭代）

| # | 任务 | 验收标准 |
|---|---|---|
| P1-1 | 建立最小测试体系：`tests/build-check.mjs`、sanitizer 测试、备份格式测试 | `npm test` 或等效命令可重复运行 |
| P1-2 | 统一 `build.mjs` 与 `build.ps1` 行为：rollback、产物哈希、占位符检查 | 两脚本产物一致，且都有回滚保护 |
| P1-3 | 补全第三方依赖台账：版本、许可证、来源 URL、哈希、更新时间 | `THIRD_PARTY_NOTICES.md` 完整可审计 |
| P1-4 | 发布校验和：生成 `SHA256SUMS.txt`，纳入 [RELEASING.md](RELEASING.md) | 每次发布附带校验和 |
| P1-5 | Sitecase 真机测试：存储持久化、文件选择、内存、图片布局 | [TESTING.md](TESTING.md) 移动端矩阵全部通过 |
| P1-6 | 补齐 `jwpub://c/` 样本验证 | 注释链接能本地匹配或给出准确原因 |
| P1-7 | 备份健壮性：完整性校验、恢复失败提示、非原子风险说明 | 大备份与中断场景有明确行为 |

---

## P2 · 正式扩展体系（2–4 个迭代）

目标：把“配置点”演进为“受控插件”，但保持离线、安全、可回滚。

### P2-1 稳定核心 API

- 把 `window.__offlineLibrary` 演进为版本化 API：`core/v1`；
- 冻结分类规则、语言包、备份格式标识与 localStorage key；
- 破坏性变更必须提升 `moduleApiVersion`。

### P2-2 插件基础设施

- 设计 `plugin.json`：`id`、`version`、`apiVersion`、`permissions`、`entry`；
- 实现 `registerPlugin` / `activatePlugin` / `deactivatePlugin` / `listPlugins`；
- 生命周期：`validate → install → activate → deactivate → uninstall`；
- 插件状态存 `system` store，启用顺序确定。

### P2-3 首批扩展点（按风险递增）

1. `catalog.classifyPublication`：规则链扩展；
2. `language.pack`：正式化语言包；
3. `reader.theme`：仅 scoped CSS；
4. `reader.routeJwpubLink`：resolver 链，失败回退内置逻辑；
5. `backup.migrate`：格式迁移钩子（严格校验）。

### P2-4 隔离与安全

- Web Worker 或 sandbox iframe + `postMessage`；
- 默认禁用 `fetch` / XHR / WebSocket / `eval` / `new Function`；
- 插件只拿到受限 facade，不接触共享 IIFE 作用域；
- 存储 namespace：`plugin:<id>:`；
- 单插件异常不能阻断启动；
- 外部插件需显式导入并确认权限，建议校验哈希/签名。

### P2-5 示例与文档

- 一个分类插件示例；
- 一个主题插件示例；
- 插件 API 兼容性测试；
- 更新 [PLUGINS.md](PLUGINS.md) 从“规划”改为“已实现”。

---

## P3 · 长期演进

| # | 任务 | 说明 |
|---|---|---|
| P3-1 | 模块边界重构：六文件共享 IIFE → 显式模块 | 可用构建期打包，避免运行时 ES Module 的 `file://` 限制 |
| P3-2 | `cleanHtml()` 黑名单 → 白名单 | 明确允许的标签/属性集，降低 XSS 面 |
| P3-3 | 备份增加完整性校验与可选加密 | 加密需明确恢复流程与密钥丢失风险 |
| P3-4 | 诊断导出脱敏 | 允许去掉书名、UA、存储细节后再分享 |
| P3-5 | 移动端增强 | 仅在 Sitecase 真机确认存储与内存边界后启动 |
| P3-6 | 无障碍与国际化打磨 | 键盘导航、屏幕阅读器、RTL 预留 |

---

## 下一步建议（按执行顺序）

1. **今天**：更新 CHANGELOG 到 0.13.0；修复 `titleRich` / `subtitleRich` 与高亮颜色注入；处理 `_cf` 文件。
2. **网络恢复当天**：修复本地 Git 历史，接回 `origin/main`，保留文档提交。
3. **本周内**：建立 `tests/build-check.mjs` 与 sanitizer 回归；跑一遍完整测试矩阵。
4. **下一迭代**：统一构建脚本、补第三方台账、做 Sitecase 真机验证。
5. **之后**：再启动插件 API 设计；在 API 冻结前不要写第三方插件。

## 明确暂不做

- 不做服务端、账号、云同步；
- 不在 P0/P1 引入插件系统；
- 不在真机验证前投入移动端专项优化；
- 不在没有回归测试的情况下重构 sanitizer。
