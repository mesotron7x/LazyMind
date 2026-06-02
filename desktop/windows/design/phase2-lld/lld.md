# Phase 2 打安装包 — Low-Level Design 总览

## 1. 背景

新版 Phase 2 对应 HLD 中的“打安装包”阶段。原 Phase 2 Complete Features 的功能实现内容已经并入新版 Phase 1；本目录下既有 `01-sqlite-complete.md`、`02-milvus-lite.md`、`03-segment-store-local.md`、`04-algorithm-pipeline.md`、`05-runtime-store-hardening.md`、`06-frontend-complete.md`、`07-credential-security.md`、`08-test-plan.md` 作为新版 Phase 1 的参考资料保留。

后续新增或重写 Phase 2 LLD 时，应聚焦 Windows installer、升级、卸载、签名、自动更新、干净环境验证和 GitHub CI artifact，不再把真实功能闭环放到 Phase 2。

---

## 2. Phase 2 目标

1. 基于 Phase 1 已验证的 `~/LazyMind_dev/` 自包含目录，生成 Windows installer。
2. 安装后无需 Docker、Node、Go、Python 等开发环境。
3. 安装目录与用户数据目录分离。
4. Go 后端 exe、Python 可执行目录、Milvus Lite 依赖、Electron 资源均随包分发。
5. 升级保留用户数据并执行必要 migration。
6. 卸载默认保留用户数据，并可提供清理选项。
7. 支持普通用户权限、中文路径、空格路径。
8. 诊断包、日志、崩溃收集在安装包环境可用。
9. GitHub CI 能生成可追溯 artifact，附带 commit SHA、版本号、构建日志和 SHA256。
10. 签名证书、发布 token、自动更新密钥只通过安全 secret 注入，不写入仓库或日志。

---

## 3. 模块拆分建议

| # | 模块 | 范围 |
|---|------|------|
| 01 | Electron Installer | electron-builder 配置、应用名称、图标、版本、installer 类型 |
| 02 | Backend Packaging | Go exe、Python 可执行目录、Milvus Lite 依赖、资源定位 |
| 03 | Data Directory & Migration | 安装目录 / 用户数据目录分离，升级 migration，备份和恢复提示 |
| 04 | Security & Signing | Windows 签名、完整性校验、自动更新安全、供应链扫描 |
| 05 | Clean Windows Verification | 无开发环境、普通用户权限、中文/空格路径、Defender/误报验证 |
| 06 | CI Artifact Workflow | GitHub Actions Windows workflow、缓存、artifact、校验和、日志 |
| 07 | Install/Upgrade/Uninstall Test Plan | 安装、首次启动、升级、卸载、数据保留、诊断包验收 |

---

## 4. 与 Phase 1 的边界

Phase 2 不重新实现以下功能：

- Desktop Auth 与 AI 助手模型。
- Local Proxy 和身份注入。
- SQLite / Runtime Store / Milvus Lite / SegmentStore 真实链路。
- 扫描、解析、索引、Chat/RAG 功能闭环。
- 前端 Desktop 页面隐藏和 `/model-providers` 复用。

Phase 2 只验证这些 Phase 1 功能在安装包环境中的资源定位、进程启动、数据保留、权限和诊断行为。

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
11. GitHub CI 生成 installer artifact、SHA256、commit SHA 和构建日志。
