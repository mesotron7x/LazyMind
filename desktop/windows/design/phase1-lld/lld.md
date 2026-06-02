# Phase 1 功能实现 — Low-Level Design 总览

## 1. 阶段定位

本目录定义 LazyMind Desktop Mode Phase 1 的完整功能设计。Phase 1 是完整功能交付阶段；它的交付物是一个可双击运行、功能闭环完整、可人工验收的 Windows 自包含运行目录：`~/LazyMind/LazyMind.exe`。

Phase 2 只负责把 Phase 1 的完整能力封装为 Windows installer，并验证安装、升级、卸载、签名、干净环境和 CI artifact。所有真实功能链路，包括助手、扫描、解析、索引、检索、Chat/RAG、模型配置、日志诊断和安全基线，均属于 Phase 1。

---

## 2. Phase 1 设计目标

1. **自包含可运行**：`make windows-desktop` 生成 `~/LazyMind/`，其中 `LazyMind.exe` 是人工验证入口，双击启动不弹出终端窗口。
2. **完整功能闭环**：扫描、解析、分段、embedding、Milvus Lite 向量、SegmentStore 本地检索、Chat/RAG、技能、会话和模型配置形成真实本地链路。
3. **桌面身份模型**：免登录，前台统一使用“AI 助手”；当前助手就是当前请求身份，Chat、技能、知识库、记忆、偏好按助手隔离。
4. **本地服务自治**：Electron 负责启动、健康检查、日志采集、错误展示和关闭本地 Go/Python 服务，用户不需要 Docker、Node、Go、Python 等开发环境，也不需要手工启动后端。
5. **本地数据自治**：SQLite、Runtime Store、Milvus Lite、SegmentStore 和文件目录按 Desktop 数据目录落盘，并与 Cloud/Server Mode 显式隔离。
6. **安全和诊断内建**：BrowserWindow、Preload/IPC、Local Proxy、Credential、日志、诊断包、子进程和文件访问边界在 Phase 1 内完成。
7. **Cloud 兼容**：所有 Desktop 变更通过显式模式开关隔离，不破坏 Cloud 的 Docker、Kong、PostgreSQL、Redis、Milvus、OpenSearch 路线。

---

## 3. 模块拆分

| # | 模块 | LLD | Phase 1 范围 |
|---|------|-----|--------------|
| 01 | Electron Shell & 自包含目录 | `01-electron-shell.md` | Electron 壳、自定义协议、无菜单栏、`LazyMind.exe` launcher、资源和数据目录 |
| 02 | Process Manager | `02-process-manager.md` | 启动、监控、日志采集、健康检查、关闭 Go/Python 本地服务 |
| 03 | Local Proxy & Identity Injection | `03-local-proxy.md` | REST/SSE/upload/download、本地 secret、当前助手身份注入 |
| 04 | Desktop Auth & AI Assistant | `04-desktop-auth.md` | 免登录、默认助手、AI 助手 CRUD、后台用户映射、系统管理改造 |
| 05 | SQLite Migration 基础设计 | `05-sqlite-migration.md` | SQLite 迁移策略、Pragma、ownership、Cloud 兼容基础 |
| 06 | Runtime Store 基础设计 | `06-runtime-store.md` | Redis 语义抽象、Desktop 本地实现、持久化边界基础 |
| 07 | Frontend Desktop Mode 基础设计 | `07-frontend-desktop-mode.md` | Desktop mode facade、路由隐藏、Assistant Switcher、API base 策略 |
| 08 | Logging / Diagnostics / Security Baseline | `08-logging-diagnostics-security.md` | 日志、诊断包、IPC/Renderer/Local Proxy/子进程安全基线 |
| 09 | Phase 1 验证总计划 | `09-test-plan.md` | 模块级和平台级测试矩阵 |
| 10 | SQLite Complete | `10-sqlite-complete.md` | core/auth/scan/algorithm 全量 SQLite 兼容和 DB ownership |
| 11 | Milvus Lite | `11-milvus-lite.md` | 向量 collection 生命周期、写入、查询、删除、重启恢复、Windows 验证 |
| 12 | SegmentStore Local | `12-segment-store-local.md` | 本地片段/全文检索、OpenSearch 直连收敛、行为对照 |
| 13 | Algorithm & Parsing Pipeline | `13-algorithm-pipeline.md` | 扫描、解析、分段、embedding、索引、Chat/RAG 真实链路 |
| 14 | Runtime Store Hardening | `14-runtime-store-hardening.md` | 持久状态分类、SQLite 恢复、清理策略和运行时恢复 |
| 15 | Frontend Complete Experience | `15-frontend-complete.md` | 助手管理、扫描路径、索引状态、模型配置、错误状态和数据隔离 UI |
| 16 | Credential & Secret Management | `16-credential-security.md` | 模型 key、本地 secret、OS credential / fallback、迁移和脱敏 |
| 17 | Integration Test & Performance Plan | `17-test-plan.md` | 端到端、性能、50 助手隔离、恢复、CI 和验收映射 |

> `05/06/07/09` 是基础设计与测试矩阵，`10/14/15/17` 是同一 Phase 1 的完整落地设计，不代表两个交付阶段。实现时以完整目标为准，不能把基础设计当作可交付边界。

---

## 4. 去除或隐藏的功能

Phase 1 明确不把以下能力作为 Desktop 主界面功能：

- 登录 / 注册：Desktop Mode 跳过登录页，设置页不显示“前往登录”。
- 用户角色管理 / 复杂 RBAC：底层表、默认组、默认权限保留；前台入口隐藏。
- 用户概念：前台统一改称“AI 助手”，新建用户显示为“新建 AI 助手”。
- Evo：Desktop UI 和主链路不显示入口；后端如保留模块，必须通过模式开关禁用。
- 模型配置：不新增 Desktop 专属简化页面，直接复用 `/model-providers`。

这些是产品范围裁剪，不是 Phase 1 未完成项。

---

## 5. 依赖图

```text
01 Electron Shell ─┬─> make windows-desktop ─┬─> Phase 1 自包含目录验收
                  │                         │
                  ├─> 02 Process Manager ───┼─> 03 Local Proxy
                  │                         └─> 08 Security / Diagnostics
                  │
05/10 SQLite ─────┬─> 04 Desktop Auth ──────┐
                  ├─> 06/14 Runtime Store   │
                  └─> 13 Algorithm Pipeline │
                                             ├─> 15 Frontend Complete ─> 17 E2E / Performance
11 Milvus Lite ───────┐                     │
12 SegmentStore ──────┼─> 13 Algorithm ─────┘
16 Credential ────────┘
```

---

## 6. 并行开发策略

### Wave 0：Desktop Shell、构建入口和安全底座

| 模块 | 说明 |
|------|------|
| 01 Electron Shell | 建立 Desktop 工程、自定义协议、数据目录、无菜单栏、launcher 资源。 |
| Windows Build Workflow | 打通 `make windows-desktop`、clean、输出目录、配置复制、图标和 `nul` artifact 检查。 |
| 08 Security / Diagnostics | 安全常量、IPC 白名单、日志脱敏、诊断包边界和子进程安全默认值。 |

### Wave 1：本地运行时与数据层

| 模块 | 说明 |
|------|------|
| 02 Process Manager | 管理 core/auth/algorithm/scan/file-watcher 生命周期。 |
| 03 Local Proxy | 路由、SSE/upload/download、身份和本地 secret 注入。 |
| 05 + 10 SQLite | 完成所有必需 SQLite migration、DB ownership 和 Cloud 兼容分支。 |
| 06 + 14 Runtime Store | 替换 Redis 语义，确定易失/持久状态和恢复策略。 |

### Wave 2：身份、检索和算法链路

| 模块 | 说明 |
|------|------|
| 04 Desktop Auth | 默认助手、AI 助手 CRUD、系统管理改造和当前助手传播。 |
| 11 Milvus Lite | 完成向量存储协议、Windows smoke、重启恢复和重建。 |
| 12 SegmentStore Local | 完成本地片段/全文检索并收敛 OpenSearch 直连。 |
| 13 Algorithm Pipeline | 文档解析、分段、embedding、向量/片段索引、Chat/RAG。 |
| 16 Credential | 模型配置复用、密钥存储、credential bridge 和脱敏边界。 |

### Wave 3：前端完整体验和总体验收

| 模块 | 说明 |
|------|------|
| 07 + 15 Frontend | Assistant Switcher、隐藏页面、扫描/索引状态、模型配置、错误状态和数据隔离 UI。 |
| 09 + 17 Test Plan | 自包含目录、默认文档闭环、50 助手隔离、启动/性能/稳定性、安全和 Cloud 回归。 |

---

## 7. 关键接口契约

| 生产方 | 消费方 | 契约内容 |
|--------|--------|----------|
| 01 | Build/02/08 | `DataDirPaths`、资源目录、`LazyMind.exe` launcher 路径 |
| Build | 17 | `~/LazyMind/` 输出结构、build clean 规则、配置复制规则 |
| 02 | 03/08/17 | 服务端口、健康状态、stdout/stderr 日志流、关闭语义 |
| 03 | 04/13/15 | API base URL、`X-User-ID` 覆盖规则、`X-Desktop-Secret` |
| 04 | 03/15 | 当前助手 ID、助手列表、助手 CRUD API |
| 05/10 | 04/13/14 | SQLite DSN、DB ownership、migration 完整性 |
| 06/14 | 13 | Chat 状态、取消信号、多回答关联、重启恢复语义 |
| 11 | 13 | VectorStore collection/insert/search/delete API |
| 12 | 13 | SegmentStore index/search/delete API |
| 13 | 15/17 | 扫描、解析、索引、Chat/RAG 状态 API |
| 16 | 13/15/08 | inner/dynamic 模型配置、credential IPC/bridge、脱敏规则 |
| 08 | 所有 | BrowserWindow defaults、CSP、IPC allowlist、日志 sanitizer、诊断包边界 |

---

## 8. Phase 1 验收总览

1. `make windows-desktop` 在 Windows PowerShell 环境可执行。
2. build 前自动终止旧进程并清除旧 `~/LazyMind/`。
3. `~/LazyMind/LazyMind.exe` 双击启动，无终端窗口。
4. Desktop UI 无默认 Electron 菜单栏。
5. 应用内 `lazymind:` 链接不会触发 unsupported protocol。
6. 无需登录，直接进入主界面。
7. 默认显示“天文学家”助手和约 100KB 太阳系 Markdown 示例文档。
8. 可创建、切换、删除/归档 AI 助手，至少 50 个助手隔离验证通过。
9. 前台不显示用户角色管理、复杂 RBAC、Evo、前往登录入口。
10. `/model-providers` 可作为 Desktop 模型配置入口。
11. SQLite、Runtime Store、Milvus Lite、SegmentStore 本地实现均进入真实链路。
12. 默认文档可扫描、解析、索引，并进入 Chat/RAG 闭环；mock 模型状态下有明确提示和配置入口。
13. 关闭应用后所有子进程退出。
14. 重启后数据和上次助手选择保留。
15. 诊断包可导出，且不含明文密钥、token、用户文档正文。
16. BrowserWindow、Preload/IPC、Local Proxy、本地 secret、子进程、文件访问和日志脱敏安全 smoke 通过。
17. Cloud/Server Mode 默认行为不变。
