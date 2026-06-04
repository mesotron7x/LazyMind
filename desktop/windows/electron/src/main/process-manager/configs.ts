import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { getDataDir } from '../data-dir';
import { getDesktopRoot, isPortableRuntime } from '../runtime';
import { DEFAULT_PORTS } from '../../shared/constants';
import type { ProcessConfig } from './types';

function isDesktopRuntime(): boolean {
  return app.isPackaged || isPortableRuntime();
}

function getBinDir(): string {
  const desktopRoot = getDesktopRoot();
  if (desktopRoot) return path.join(desktopRoot, 'bin');
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin');
  }
  return path.resolve(__dirname, '../../../../../backend');
}

function getAlgorithmDir(): string {
  const desktopRoot = getDesktopRoot();
  if (desktopRoot) return path.join(desktopRoot, 'algorithm');
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'algorithm');
  }
  return path.resolve(__dirname, '../../../../../algorithm');
}

function getPythonExecutable(): string {
  const desktopRoot = getDesktopRoot();
  if (desktopRoot) return path.join(desktopRoot, 'python', 'python.exe');
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'python.exe');
  }
  return 'python';
}

function ensureDesktopConfigs(dataDir: { root: string; data: string; logs: string }): {
  scanConfig: string;
  fileWatcherConfig: string;
} {
  const configDir = path.join(dataDir.root, 'configs');
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir.data, 'scan'), { recursive: true });

  const scanConfig = path.join(configDir, 'scan-control-plane.yaml');
  const scanContent = `listen_addr: "127.0.0.1:${DEFAULT_PORTS.scan}"
database_driver: "sqlite"
database_dsn: "${path.join(dataDir.data, 'scan.db').replace(/\\/g, '/')}"
log_level: "info"
agent_token: ""
default_idle_window: "10m"
scheduler_tick: "60s"

event_merge:
  flush_tick: "1s"
  flush_idle: "8s"
  flush_max_wait: "20s"
  flush_batch_size: 512
  max_memory_keys: 20000

worker:
  enabled: true
  execution_mode: "core_task"
  tick: "5s"
  max_concurrent: 2
  max_per_tenant: 2
  max_per_source: 1
  max_large_file: 1
  large_file_threshold_bytes: 104857600
  claim_batch_size: 16
  lease_duration: "45s"
  retry_base_backoff: "10s"
  retry_max_backoff: "5m"
  agent_timeout: "20s"
  command_ack_timeout: "60s"
  command_max_attempts: 6
  agent_offline_timeout: "90s"

parser:
  enabled: false
  endpoint: ""
  timeout: "60s"
  auth_token: ""

core:
  enabled: true
  endpoint: "http://127.0.0.1:${DEFAULT_PORTS.core}"
  dataset_id: ""
  user_id: "11111111-1111-1111-1111-111111111111"
  user_name: "scan-control-plane"
  start_mode: "ASYNC"
  auth_token: ""
  timeout: "60s"

metrics:
  enabled: true
  tick: "60s"

cloud_sync:
  enabled: false
`;
  fs.writeFileSync(scanConfig, scanContent, 'utf-8');

  const fileWatcherConfig = path.join(configDir, 'file-watcher.yaml');
  const scanDataDir = path.join(dataDir.data, 'scan').replace(/\\/g, '/');
  const fwContent = `agent_id: "file-watcher-desktop"
tenant_id: "desktop-tenant"
agent_token: ""
listen_addr: "127.0.0.1:${DEFAULT_PORTS.fileWatcher}"
advertise_addr: "http://127.0.0.1:${DEFAULT_PORTS.fileWatcher}"
control_plane_base_url: "http://127.0.0.1:${DEFAULT_PORTS.scan}"
heartbeat_interval: "30s"
pull_interval: "20s"
reconcile_interval: "20m"
base_root: "${scanDataDir}"
host_path_style: "windows"
log_level: "info"

watch:
  debounce_window: "10s"
  max_batch_size: 512
  recursive: true

scan:
  batch_size: 1000
  max_concurrency: 2
  large_file_threshold_mb: 200

security:
  allowed_roots:
    - "C:\\\\"
    - "D:\\\\"
    - "E:\\\\"
    - "F:\\\\"

http:
  read_timeout: "10s"
  write_timeout: "30s"
`;
  fs.writeFileSync(fileWatcherConfig, fwContent, 'utf-8');

  return { scanConfig, fileWatcherConfig };
}

export function getProcessConfigs(): ProcessConfig[] {
  const dataDir = getDataDir();
  const binDir = getBinDir();
  const algorithmDir = getAlgorithmDir();
  const pythonExe = getPythonExecutable();
  const desktopRuntime = isDesktopRuntime();
  const { scanConfig, fileWatcherConfig } = ensureDesktopConfigs(dataDir);

  const configs: ProcessConfig[] = [
    {
      name: 'auth-service',
      executablePath: desktopRuntime
        ? path.join(binDir, 'auth-service', 'auth-service.exe')
        : pythonExe,
      args: desktopRuntime
        ? []
        : ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(DEFAULT_PORTS.auth)],
      env: {
        LAZYMIND_DATABASE_URL: `sqlite:///${path.join(dataDir.data, 'auth.db')}`,
        LAZYMIND_DESKTOP_MODE: 'true',
        LAZYMIND_BOOTSTRAP_ADMIN_USERNAME: 'system-admin',
        LAZYMIND_BOOTSTRAP_ADMIN_PASSWORD: 'desktop-local',
        LAZYMIND_JWT_SECRET: 'lazymind-desktop-local',
        SERVER_HOST: '127.0.0.1',
        SERVER_PORT: String(DEFAULT_PORTS.auth),
      },
      cwd: desktopRuntime
        ? path.join(binDir, 'auth-service')
        : path.join(binDir, 'auth-service'),
      port: DEFAULT_PORTS.auth,
      healthCheck: {
        type: 'http',
        endpoint: '/api/authservice/auth/health',
        intervalMs: 2000,
        timeoutMs: 5000,
        retries: 15,
      },
      dependsOn: [],
      startupTimeout: 30000,
      restartPolicy: 'on-failure',
      maxRestarts: 3,
    },
    {
      name: 'core',
      executablePath: desktopRuntime
        ? path.join(binDir, 'core.exe')
        : path.join(binDir, 'core', 'core.exe'),
      args: [],
      env: {
        ACL_DB_DRIVER: 'sqlite',
        ACL_DB_DSN: path.join(dataDir.data, 'main.db'),
        LAZYMIND_STATE_BACKEND: 'memory',
        LAZYMIND_MODE: 'desktop',
        LAZYMIND_JWT_SECRET: 'lazymind-desktop-local',
        LAZYMIND_ALGO_SERVICE_URL: `http://127.0.0.1:${DEFAULT_PORTS.parsing}`,
        LAZYMIND_PARSING_SERVICE_URL: `http://127.0.0.1:${DEFAULT_PORTS.processor}`,
        LAZYMIND_CHAT_SERVICE_URL: `http://127.0.0.1:${DEFAULT_PORTS.chat}`,
        LAZYMIND_AUTH_SERVICE_URL: `http://127.0.0.1:${DEFAULT_PORTS.auth}/api/authservice`,
        LAZYMIND_SCAN_CONTROL_PLANE_URL: `http://127.0.0.1:${DEFAULT_PORTS.scan}`,
        MIGRATIONS_DIR: desktopRuntime
          ? path.join(binDir, 'migrations', 'sqlite')
          : path.join(binDir, 'core', 'migrations', 'sqlite'),
        SERVER_PORT: String(DEFAULT_PORTS.core),
        SERVER_HOST: '127.0.0.1',
      },
      cwd: desktopRuntime ? binDir : path.join(binDir, 'core'),
      port: DEFAULT_PORTS.core,
      healthCheck: {
        type: 'http',
        endpoint: '/health',
        intervalMs: 2000,
        timeoutMs: 5000,
        retries: 15,
      },
      dependsOn: ['auth-service'],
      startupTimeout: 30000,
      restartPolicy: 'on-failure',
      maxRestarts: 3,
    },
    {
      name: 'scan-control-plane',
      executablePath: desktopRuntime
        ? path.join(binDir, 'scan-control-plane.exe')
        : path.join(binDir, 'scan-control-plane', 'cmd', 'scan-control-plane.exe'),
      args: ['--config', scanConfig],
      env: {
        LAZYMIND_MODE: 'desktop',
      },
      cwd: desktopRuntime
        ? binDir
        : path.join(binDir, 'scan-control-plane'),
      port: DEFAULT_PORTS.scan,
      healthCheck: {
        type: 'http',
        endpoint: '/healthz',
        intervalMs: 3000,
        timeoutMs: 5000,
        retries: 10,
      },
      dependsOn: ['core'],
      startupTimeout: 20000,
      restartPolicy: 'on-failure',
      maxRestarts: 3,
    },
    {
      name: 'file-watcher',
      executablePath: desktopRuntime
        ? path.join(binDir, 'file-watcher.exe')
        : path.join(binDir, 'file-watcher', 'cmd', 'file-watcher.exe'),
      args: ['--config', fileWatcherConfig],
      env: {
        LAZYMIND_MODE: 'desktop',
        LAZYMIND_DATA_DIR: dataDir.data,
      },
      cwd: desktopRuntime
        ? binDir
        : path.join(binDir, 'file-watcher'),
      port: DEFAULT_PORTS.fileWatcher,
      healthCheck: {
        type: 'http',
        endpoint: '/healthz',
        intervalMs: 3000,
        timeoutMs: 5000,
        retries: 10,
      },
      dependsOn: ['scan-control-plane'],
      startupTimeout: 20000,
      restartPolicy: 'on-failure',
      maxRestarts: 3,
    },
    {
      name: 'chat',
      executablePath: desktopRuntime
        ? path.join(algorithmDir, 'chat', 'chat.exe')
        : pythonExe,
      args: desktopRuntime
        ? []
        : ['-m', 'chat.app.chat', '--host', '127.0.0.1', '--port', String(DEFAULT_PORTS.chat)],
      env: {
        LAZYMIND_MODE: 'desktop',
        LAZYMIND_MOUNT_BASE_DIR: dataDir.data,
        LAZYMIND_MILVUS_URI: path.join(dataDir.vector, 'milvus.db'),
        LAZYMIND_DATABASE_URL: `sqlite:///${path.join(dataDir.data, 'algorithm.db')}`,
        LAZYMIND_ALGO_SERVICE_URL: `http://127.0.0.1:${DEFAULT_PORTS.parsing}`,
        LAZYMIND_CORE_API_URL: `http://127.0.0.1:${DEFAULT_PORTS.core}`,
        LAZYMIND_CORE_SERVICE_URL: `http://127.0.0.1:${DEFAULT_PORTS.core}`,
        LAZYMIND_DOCUMENT_SERVER_URL: `http://127.0.0.1:${DEFAULT_PORTS.parsing}`,
        LAZYMIND_DOCUMENT_PROCESSOR_URL: `http://127.0.0.1:${DEFAULT_PORTS.processor}`,
        LAZYMIND_SHARED_UPLOAD_DIR: dataDir.uploads,
        LAZYMIND_SKIP_STARTUP_PIPELINE: 'false',
        LAZYMIND_RAG_MODE: 'true',
        LAZYMIND_OCR_SERVER_TYPE: 'none',
      },
      cwd: desktopRuntime
        ? path.join(algorithmDir, 'chat')
        : algorithmDir,
      port: DEFAULT_PORTS.chat,
      healthCheck: {
        type: 'http',
        endpoint: '/health',
        intervalMs: 3000,
        timeoutMs: 5000,
        retries: 20,
      },
      dependsOn: ['core'],
      startupTimeout: 60000,
      restartPolicy: 'on-failure',
      maxRestarts: 3,
    },
    {
      name: 'parsing',
      executablePath: desktopRuntime
        ? path.join(algorithmDir, 'parsing', 'parsing.exe')
        : pythonExe,
      args: desktopRuntime
        ? []
        : ['-m', 'parsing.parsing', '--host', '127.0.0.1', '--port', String(DEFAULT_PORTS.parsing)],
      env: {
        LAZYMIND_MODE: 'desktop',
        LAZYMIND_MILVUS_URI: path.join(dataDir.vector, 'milvus.db'),
        LAZYMIND_DATABASE_URL: `sqlite:///${path.join(dataDir.data, 'algorithm.db')}`,
        LAZYMIND_DOCUMENT_PROCESSOR_URL: `http://127.0.0.1:${DEFAULT_PORTS.processor}`,
        LAZYMIND_ALGO_SERVER_PORT: String(DEFAULT_PORTS.parsing),
        LAZYMIND_SHARED_UPLOAD_DIR: dataDir.uploads,
        LAZYMIND_OCR_SERVER_TYPE: 'none',
        LAZYMIND_CORE_API_URL: `http://127.0.0.1:${DEFAULT_PORTS.core}`,
        LAZYMIND_CORE_SERVICE_URL: `http://127.0.0.1:${DEFAULT_PORTS.core}`,
      },
      cwd: desktopRuntime
        ? path.join(algorithmDir, 'parsing')
        : algorithmDir,
      port: DEFAULT_PORTS.parsing,
      healthCheck: {
        type: 'http',
        endpoint: '/health',
        intervalMs: 3000,
        timeoutMs: 5000,
        retries: 20,
      },
      dependsOn: ['core'],
      startupTimeout: 60000,
      restartPolicy: 'on-failure',
      maxRestarts: 3,
    },
    {
      name: 'processor',
      executablePath: desktopRuntime
        ? path.join(algorithmDir, 'processor', 'processor.exe')
        : pythonExe,
      args: desktopRuntime
        ? []
        : ['-m', 'processor.main', '--host', '127.0.0.1', '--port', String(DEFAULT_PORTS.processor)],
      env: {
        LAZYMIND_MODE: 'desktop',
        LAZYMIND_MILVUS_URI: path.join(dataDir.vector, 'milvus.db'),
        LAZYMIND_DATABASE_URL: `sqlite:///${path.join(dataDir.data, 'algorithm.db')}`,
        LAZYMIND_DOCUMENT_PROCESSOR_PORT: String(DEFAULT_PORTS.processor),
        LAZYMIND_SHARED_UPLOAD_DIR: dataDir.uploads,
        LAZYMIND_UPLOAD_DIR: dataDir.uploads,
        LAZYMIND_OCR_SERVER_TYPE: 'none',
        LAZYMIND_CORE_API_URL: `http://127.0.0.1:${DEFAULT_PORTS.core}`,
        LAZYMIND_CORE_SERVICE_URL: `http://127.0.0.1:${DEFAULT_PORTS.core}`,
      },
      cwd: desktopRuntime
        ? path.join(algorithmDir, 'processor')
        : algorithmDir,
      port: DEFAULT_PORTS.processor,
      healthCheck: {
        type: 'http',
        endpoint: '/health',
        intervalMs: 3000,
        timeoutMs: 5000,
        retries: 20,
      },
      dependsOn: ['core'],
      startupTimeout: 60000,
      restartPolicy: 'on-failure',
      maxRestarts: 3,
    },
  ];

  return configs;
}
