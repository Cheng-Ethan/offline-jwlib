# 文档受众分层、移动端说明与版本规则 — 设计文档

日期：2026-11-24  
状态：待批准  
基线版本：`0.13.0`（保持不变，作为我们自己的初始版本；上游历史视为折叠）

## 1. 意图

当前仓库有 28 个 Markdown 文件，用户和开发者文档混在一起，导致：

- 普通用户被架构、备份格式、插件 API 等细节淹没；
- 开发者文档缺少稳定的“规则源”，不同 session 容易各自发明版本与分支规则；
- 移动端（Android / iPhone）打开本地 HTML 的前置条件没有写清楚；
- “用户自定义语言 JSON”已经是可用的扩展方式，但没有被正式命名为插件 v0；
- 版本号什么时候变、怎么变，没有落盘规则。

目标是把这些规则写进仓库，使未来任何新 session 进来都能按同一套约定工作。

## 2. 目标 / 非目标 / 反目标

### 目标

- 用户只读 `docs/user/`，开发者只读 `docs/dev/`；
- `AGENTS.md` 成为所有 session 的单一规则源；
- 移动端说明包含可操作步骤与风险提示；
- 语言包被正式记录为“用户插件 v0”；
- 版本规则可 machine-readable 地被人和 agent 找到。

### 非目标

- 不改任何运行时源码逻辑；
- 不实现真正的代码插件系统；
- 不引入 npm / 构建框架；
- 不把当前文档改动解释为一次版本升级。

### 反目标（会视为失败）

- 用户文档里继续出现 IndexedDB store、IIFE、sanitizer 等开发者术语；
- 开发者找不到唯一的规则文件；
- 未来 session 仍需向用户重新询问版本或分支规则。

## 3. 约束

- 当前 `develop` 分支已有未提交文档，先提交，再重排结构；
- 用户明确要求：当前修改全部放 `develop`，之后由用户决定何时推到 `master`；
- 用户明确要求：保留 `0.13.0` 作为基线；
- 用户明确要求：改进要升版本，纯 bug 修复不升版本；
- 双语言要求：中英都要有；
- 不做未经验证的 App 背书，移动端方法要写明“需真机验证”。

## 4. 方案比较

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| A（选中） | 拆 `docs/user/` 与 `docs/dev/`，新增 `AGENTS.md` 作为规则源 | 受众清晰；session 有唯一规则文件；最符合用户诉求 | 文件移动较多，链接需要全量校验 |
| B | 保持扁平 `docs/`，加受众标签和索引 | 改动最小 | 用户和开发者仍混读；规则仍容易散落 |
| C | 用户文档合并为一本《用户手册》，开发者多文件 | 用户最简单 | 单文件维护成本高；双语重复量大 |

选择 A：它同时解决“受众分层”和“session 规则持久化”，而 B 只解决一半，C 维护成本过高。

## 5. 版本规则（写入 AGENTS.md）

基线：`0.13.0`。本次文档重构属于基线的一部分，不额外升版本。

| 变更类型 | 版本动作 | 例子 |
|---|---|---|
| 破坏性变更：备份格式、模块 API、数据结构、插件 API 不兼容 | 升 major：`x.0.0` | 备份格式 v2、模块顺序改变 |
| 新功能 / 新用户可见能力 / 新扩展点 / 新平台支持文档 | 升 minor：`0.x.0` | 新增搜索、语言包 v1、Android 支持 |
| 非破坏性的文档或构建改进，不新增用户功能 | 升 patch：`0.x.y` | 文档重构、构建脚本加固、依赖台账 |
| 纯 bug 修复 | **不升版本** | 修 XSS、修导入失败、修错字 |

版本更新必须同步：

1. `project.json` 的 `appVersion`；
2. `src/modules/00-core-db.js` 的版本常量；
3. `CHANGELOG.md`；
4. `README.md` / `README.en.md` 的版本行；
5. HTML meta 由构建自动注入，不手改产物。

## 6. 目标文件结构

```text
README.md                      # 用户入口 + 开发者入口两张表
README.en.md
AGENTS.md                      # 所有 session 的唯一规则源（中文为主，英文摘要）
CONTRIBUTING.md                # 指向 AGENTS.md，不再重复规则
SECURITY.md
CODE_OF_CONDUCT.md
LICENSE
THIRD_PARTY_NOTICES.md
CHANGELOG.md

docs/user/
  INSTALL.md                   # 用户视角：拿到 HTML、放到设备、升级备份
  USAGE.md                     # 导入、阅读、标注、备份、语言包
  MOBILE.md                    # Android / iPhone 具体打开方式
  FAQ.md                       # 用户常见问题（含私有仓库简短说明）
docs/en/user/                  # 对应英文

docs/dev/
  ARCHITECTURE.md
  PLUGINS.md                   # 扩展点 + 语言包 v0 + 插件规划
  BACKUP_FORMAT.md
  TESTING.md
  RELEASING.md
  DEVELOPMENT_PLAN.md
  DEVELOPMENT_RULES.md         # 人类可读的规则说明，明确 AGENTS.md 为准
docs/en/dev/                   # 对应英文

docs/superpowers/specs/        # 设计文档归档
```

`README.md` 顶部改成两张表：

- **我是用户**：安装到设备、使用指南、移动端、FAQ
- **我是开发者**：架构、插件、备份格式、测试、发布、开发计划、规则

## 7. 移动端说明要点（写入 docs/user/MOBILE.md）

### iPhone

- 推荐：Sitecase 导入本地 HTML，作为独立项目；
- 步骤：旧项目导出完整备份 → 导入新 HTML → 恢复备份 → 验证后删除旧项目；
- 风险：项目间 IndexedDB 可能隔离；系统文件选择器和持久化需真机验证。

### Android

给出两条可操作路径，并标注需真机验证：

1. **稳定来源方案（推荐）**：用 Termux 等本地 shell 跑 `python3 -m http.server 8080`，浏览器打开 `http://127.0.0.1:8080/offline_library.html`，获得稳定 origin，避免 `file://` 存储限制；
2. **WebView 容器方案**：用支持本地 HTML 与存储的 WebView/HTML Viewer 类 App 打开；不同 App 的 IndexedDB/持久化差异大，必须先跑备份恢复验证。

明确说明：`file://` 直接打开在部分浏览器会禁用 IndexedDB 或把每个文件当独立 origin，不作为推荐路径。

## 8. 语言包 v0 的定义

- 用户侧名称：**用户语言包（插件 v0）**；
- 能力：导入 JSON，替换界面语言字符串；
- 边界：不能注册代码、不能拦截事件、不能访问出版物数据；
- 位置：用户文档写“怎么用”，开发者文档写 `registerLanguagePack()` API 与持久化 key；
- 不把它误称为完整插件系统。

## 9. AGENTS.md 内容大纲

1. 先读本文件，再读 `README.md` 与 `docs/dev/DEVELOPMENT_RULES.md`；
2. 分支：`develop` 是开发流；不要直接 push `master`；不要 force push；
3. 版本规则（第 5 节表格）；
4. 文档分受众规则（用户看 `docs/user/`，开发者看 `docs/dev/`）；
5. 语言包 v0 定义；
6. 安全规则：不提交 JWPUB 样本/备份；漏洞走 SECURITY.md；
7. 提交约定：`type: 简短描述`，一次提交一件事；
8. 当前基线说明：`0.13.0`，历史折叠，从下一次改动开始按规则升版本。

## 10. 实施顺序

1. 提交当前未提交的文档到 `develop`（不做结构调整）；
2. 建立 `docs/user/`、`docs/dev/` 及英文对应目录；
3. 移动/复制现有文档到新位置，重写 README 两张表；
4. 新增 `MOBILE.md`（中英）；
5. 新增 `AGENTS.md` 与 `docs/dev/DEVELOPMENT_RULES.md`（中英）；
6. 更新 `CONTRIBUTING.md`、`CHANGELOG.md`、所有交叉链接；
7. 跑 Markdown 本地链接校验，确保 0 失效；
8. 提交到 `develop`，不 push `master`。

## 11. 验收

- 用户从 README 能只点进用户文档完成“拿到 HTML → 放到手机/电脑 → 导入 → 阅读 → 备份”；
- 开发者从 README 能只点进开发者文档找到架构、规则、版本和分支约定；
- 移动端文档给出 iPhone/Android 具体步骤和验证要求；
- `AGENTS.md` 包含完整版本规则且被 CONTRIBUTING 引用；
- 本地链接校验 0 失败；
- 所有改动仅在 `develop`，未 push `master`。
