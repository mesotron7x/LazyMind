# Phase 1 功能实现 — Low-Level Design 总览

## 1. 背景

本目录包含 LazyMind Desktop Mode 新版 Phase 1 的 Low-Level Design。新版 Phase 1 合并原前两个阶段：不再只验证桌面主链路，而是要在本地 build 出自包含运行目录 `~/LazyMind_dev/`，目录内 `LazyMind.exe` 可双击启动，并在功能层面等效大部分 Web 版。

原 `phase2-lld/` 中的 SQLite Complete、Milvus Lite、SegmentStore、Algorithm Pipeline、Runtime Store Hardening、Frontend Complete、Credential Security 和 Test Plan 设计，全部作为新版 Phase 1 的输入并入本阶段。新版 Phase 2 只保留安装包、升级、卸载、签名和 CI artifact 相关工作。

---

## 2. 设计目标

1. **可双击运行**：`make desktop-dev-windows-exe` 生成 `~/LazyMind_dev/`，其中 `LazyMind.exe` 是人工验证入口，双击启动不弹出终端窗口。
2. **功能闭环**：扫描、解析、索引、Milvus Lite 向量、SegmentStore 本地检索、Chat/RAG、技能、会话、模型配置形成真实本地链路。
3. **桌面体验**：免登录、隐藏登录/RBAC/用户角色/Evo 入口，前台统一展示 AI 助手。
4. **助手隔离**：当前助手就是当前请求用户，Chat、技能、知识库、记忆、偏好按助手隔离，至少验证 50 个助手。
5. **Cloud 兼容**：所有变更通过显式 Desktop Mode 开关隔离，不破坏 Cloud 的 Docker、Kong、PostgreSQL、Redis、Milvus、OpenSearch 路线。
6. **Windows 原生构建**：Makefile / PowerShell 命令兼容 Windows，不依赖 Unix-only 工具；build 前自动 clean；Vite 外部 `outDir` 使用 `--emptyOutDir`。

---

## 3. 模块拆分

### 3.1 模块列表

| # | 模块 | 主要参考文档 | 新版 Phase 1 范围 |
|---|------|--------------|-------------------|
| 01 | Electron Shell & 自包含目录 | `01-electron-shell.md` + one-off | Electron 壳、自定义协议、无菜单栏、`LazyMind.exe` launcher、图标、`~/LazyMind_dev/` |
| 02 | Windows Build Workflow | one-off | `desktop-dev-windows-exe`、自动 clean、PowerShell 兼容、配置复制、`nul` artifact 检查 |
| 03 | Process Manager | `02-process-manager.md` | 启动/监控/关闭 Go/Python 服务，隐藏控制台窗口，健康检查，日志接入 |
| 04 | Local Proxy & Identity Injection | `03-local-proxy.md` | 替代 Kong，REST/SSE/upload/download，覆盖 `X-User-ID`，注入本地 secret |
| 05 | Desktop Auth & AI Assistant | `04-desktop-auth.md` | 免登录、默认助手、AI 助手 CRUD、系统管理改造、隐藏用户角色管理 |
| 06 | SQLite Complete | `05-sqlite-migration.md` + `../phase2-lld/01-sqlite-complete.md` | core/auth/scan/algorithm 全量 SQLite 兼容和 DB ownership |
| 07 | Runtime Store | `06-runtime-store.md` + `../phase2-lld/05-runtime-store-hardening.md` | Redis 语义抽象，内存实现解除阻塞，关键状态持久化 |
| 08 | Milvus Lite | `../phase2-lld/02-milvus-lite.md` | 向量 collection 生命周期、写入、查询、删除、重启恢复、Windows 验证 |
| 09 | SegmentStore Local | `../phase2-lld/03-segment-store-local.md` | 复用现有 SegmentStore，新增 Desktop 本地实现，收敛 OpenSearch 直连 |
| 10 | Algorithm & Parsing Pipeline | `../phase2-lld/04-algorithm-pipeline.md` | 扫描、解析、分段、embedding、索引、Chat/RAG 真实链路 |
| 11 | Frontend Desktop Complete | `07-frontend-desktop-mode.md` + `../phase2-lld/06-frontend-complete.md` | Assistant Switcher、页面隐藏、扫描/索引状态、复用 `/model-providers` |
| 12 | Credential & Config | `../phase2-lld/07-credential-security.md` + one-off | inner/dynamic 模型配置，废弃 Desktop 专属配置文件，密钥脱敏和 OS credential 边界 |
| 13 | Logging / Diagnostics / Security | `08-logging-diagnostics-security.md` | 日志归档、诊断包、IPC/Renderer/Local Proxy/子进程安全基线 |
| 14 | Test Plan | `09-test-plan.md` + `../phase2-lld/08-test-plan.md` | 启动、功能、隔离、性能、稳定性、自包含目录验收 |

### 3.2 去除或隐藏的功能

新版 Phase 1 对 HLD 明确去除的功能采用“隐藏界面、保留底层模型”的方式：

- 登录 / 注册：Desktop Mode 跳过登录页，设置页不显示“前往登录”。
- 用户角色管理 / 复杂 RBAC：底层表、默认组、默认权限保留；前台入口隐藏。
- 用户概念：前台统一改称“AI 助手”，新建用户显示为“新建 AI 助手”。
- Evo：Desktop UI 和主链路不显示入口；后端如保留模块，必须通过模式开关禁用。
- 模型配置：不新增 Desktop 专属简化页面，直接复用 `/model-providers`。

---

## 4. 依赖图

```text
01 Electron Shell ─┬─> 02 Windows Build Workflow ─┬─> 自包含目录验收
                  │                               │
                  ├─> 03 Process Manager ──┬──────┘
                  │                         ├─> 04 Local Proxy
                  │                         └─> 13 Logging / Security
                  │
06 SQLite Complete ─┬─> 05 Desktop Auth
                    ├─> 07 Runtime Store
                    └─> 10 Algorithm Pipeline

08 Milvus Lite ─────┐
09 SegmentStore ────┼─> 10 Algorithm Pipeline ─> 11 Frontend Complete ─> 14 Test Plan
07 Runtime Store ───┘

12 Credential & Config ───────────────┘
```

---

## 5. 并行开发策略

### Wave 0：基础与构建入口

| 模块 | 说明 |
|------|------|
| 01 Electron Shell | 建立 Desktop 工程、自定义协议、数据目录、无菜单栏、launcher 资源。 |
| 02 Windows Build Workflow | 先把 `desktop-dev-windows-exe`、clean、输出目录、配置复制打通。 |
| 13 Logging / Security | 安全常量、IPC 白名单、日志脱敏应尽早成为所有模块依赖。 |

### Wave 1：后端存储与进程

| 模块 | 说明 |
|------|------|
| 03 Process Manager | 管理 core/auth/algorithm/scan/file-watcher 生命周期。 |
| 06 SQLite Complete | 完成所有必需 SQLite migration 和 ownership。 |
| 07 Runtime Store | 替换 Redis 语义，确定持久化边界。 |
| 08 Milvus Lite | 完成向量存储协议和 Windows smoke。 |
| 09 SegmentStore Local | 完成本地片段/全文检索实现。 |

### Wave 2：身份、代理、算法链路

| 模块 | 说明 |
|------|------|
| 04 Local Proxy | 路由、SSE/upload/download、身份和本地 secret 注入。 |
| 05 Desktop Auth | 默认助手、AI 助手 CRUD、系统管理改造。 |
| 10 Algorithm Pipeline | 文档解析、分段、embedding、向量/片段索引、Chat/RAG。 |
| 12 Credential & Config | 模型配置复用、开发配置复制、密钥存储/脱敏边界。 |

### Wave 3：前端和验收

| 模块 | 说明 |
|------|------|
| 11 Frontend Complete | Assistant Switcher、隐藏页面、状态展示、`/model-providers` 复用。 |
| 14 Test Plan | 自包含目录、50 助手隔离、默认文档闭环、启动/性能/稳定性验证。 |

---

## 6. 关键接口契约

| 生产方 | 消费方 | 契约内容 |
|--------|--------|----------|
| 01 | 02/03/13 | `DataDirPaths`、资源目录、`LazyMind.exe` launcher 路径 |
| 02 | 14 | `~/LazyMind_dev/` 输出结构、build clean 规则、配置复制规则 |
| 03 | 04/13 | 服务端口、健康状态、stdout/stderr 日志流 |
| 04 | 05/10/11 | API base URL、`X-User-ID` 覆盖规则、`X-Desktop-Secret` |
| 05 | 04/11 | 当前助手 ID、助手列表、助手 CRUD API |
| 06 | 05/07/10 | SQLite DSN、DB ownership、migration 完整性 |
| 07 | 10 | Chat 状态、取消信号、多回答关联、重启恢复语义 |
| 08 | 10 | VectorStore collection/insert/search/delete API |
| 09 | 10 | SegmentStore index/search/delete API |
| 10 | 11 | 扫描、解析、索引、Chat/RAG 状态 API |
| 12 | 10/11/13 | inner/dynamic 模型配置、credential IPC/bridge、脱敏规则 |
| 13 | 所有 | BrowserWindow defaults、CSP、IPC allowlist、日志 sanitizer |

---

## 7. Phase 1 验收总览

1. `make desktop-dev-windows-exe` 在 Windows PowerShell 环境可执行。
2. build 前自动终止旧进程并清除旧 `~/LazyMind_dev/`。
3. `~/LazyMind_dev/LazyMind.exe` 双击启动，无终端窗口。
4. Desktop UI 无默认 Electron 菜单栏。
5. 应用内 `lazymind:` 链接不会触发 unsupported protocol。
6. 无需登录，直接进入主界面。
7. 默认显示“天文学家 🪐”助手和约 100KB 太阳系 Markdown 示例文档。
8. 可创建、切换、删除/归档 AI 助手，至少 50 个助手隔离验证通过。
9. 前台不显示用户角色管理、复杂 RBAC、Evo、前往登录入口。
10. `/model-providers` 可作为 Desktop 模型配置入口。
11. SQLite、Milvus Lite、SegmentStore 本地实现均进入真实链路。
12. 默认文档可扫描、解析、索引，并进入 Chat/RAG 闭环；mock 模型状态下有明确提示。
13. 关闭应用后所有子进程退出。
14. 重启后数据和上次助手选择保留。
15. 诊断包可导出，且不含明文密钥、token、用户文档正文。
16. Cloud/Server Mode 默认行为不变。
