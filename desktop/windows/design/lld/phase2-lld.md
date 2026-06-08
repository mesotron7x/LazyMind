# Phase 2 打安装包 — Low-Level Design 总览

## 1. 阶段定位

Phase 2 是安装包产品化阶段。它不重新实现 Desktop 功能，也不承接 Phase 1 未完成的功能补全；它的输入是 Phase 1 已通过验收的 `~/LazyMind/` 自包含运行目录和完整 Desktop 功能闭环，输出是可安装、可升级、可卸载、可追溯的 Windows installer。

Phase 2 的设计重点是分发形态、资源定位、安装目录与用户数据目录分离、升级和卸载、签名与完整性、干净 Windows 环境验证、GitHub Actions artifact。

---

## 2. Phase 2 目标

1. 基于 Phase 1 已验证的 `~/LazyMind/LazyMind.exe` 和完整功能闭环生成 Windows installer。
2. 安装后无需 Docker、Node、Go、Python 等开发环境。
3. 安装目录只包含应用程序和只读资源，用户数据目录保存配置、数据库、向量数据、片段索引、上传文件、日志、缓存和备份。
4. Go 后端 exe、Python 可执行目录、Milvus Lite 依赖、Electron 资源均随包分发并能通过安装包资源路径定位。
5. 升级保留用户数据并执行必要 migration；失败时保留日志、备份和恢复提示。
6. 卸载默认保留用户数据，并可提供显式清理选项。
7. 支持普通用户权限、中文路径、空格路径和干净 Windows x64 环境。
8. 诊断包、日志、崩溃收集和后端异常提示在安装包环境可用。
9. GitHub CI 能生成可追溯 artifact，附带 commit SHA、版本号、构建日志和 SHA256。
10. 签名证书、发布 token、自动更新密钥只通过安全 secret 注入，不写入仓库或日志。

---

## 3. 模块拆分

| # | 模块 | 范围 |
|---|------|------|
| 01 | Electron Installer | electron-builder 配置、应用名称、图标、版本、installer 类型、artifact 命名 |
| 02 | Backend Packaging | Go exe、Python 可执行目录、Milvus Lite 依赖、资源定位和启动参数 |
| 03 | Data Directory & Migration | 安装目录 / 用户数据目录分离、升级 migration、备份和恢复提示 |
| 04 | Security & Signing | Windows 签名、完整性校验、自动更新安全、供应链扫描和 Defender 误报治理 |
| 05 | Clean Windows Verification | 无开发环境、普通用户权限、中文/空格路径、安装/升级/卸载验证 |
| 06 | CI Artifact Workflow | GitHub Actions Windows workflow、缓存、artifact、校验和、版本元数据、构建日志 |
| 07 | Install/Upgrade/Uninstall Test Plan | 首次启动、升级、卸载、数据保留、诊断包和 Cloud 构建隔离验收 |

---

## 4. 与 Phase 1 的边界

Phase 2 不重新实现以下功能：

- Desktop Auth 与 AI 助手模型。
- Local Proxy 和身份注入。
- SQLite / Runtime Store / Milvus Lite / SegmentStore 真实链路。
- 扫描、解析、索引、Chat/RAG 功能闭环。
- 前端 Desktop 页面隐藏、助手管理、扫描/索引状态和 `/model-providers` 复用。
- Credential、日志脱敏、诊断包内容边界、IPC allowlist 和本地安全基线。

Phase 2 只验证这些 Phase 1 功能在安装包环境中的资源定位、进程启动、数据保留、权限、签名/完整性和诊断行为。

---

## 5. 验收总览

1. installer 可在干净 Windows x64 环境安装。
2. 安装后 `LazyMind.exe` 可启动，无需开发环境。
3. 首次启动初始化默认助手和默认文档。
4. 可添加文档路径、构建知识库并发起问答。
5. 关闭应用后子进程退出。
6. 重启后用户数据保留。
7. 升级安装不丢失用户数据。
8. 卸载行为符合设计。
9. 诊断包可导出且脱敏。
10. Cloud/Server Mode 构建不受影响。
11. GitHub CI 生成 installer artifact、SHA256、commit SHA、版本元数据和构建日志。
