export const PROTOCOL_SCHEME = 'lazymind';
export const APP_NAME = 'LazyMind';
export const DATA_DIR_NAME = 'LazyMind';

export const DEFAULT_PORTS = {
  proxy: 5023,
  core: 8001,
  auth: 8002,
  chat: 8046,
  parsing: 8047,
  processor: 8048,
  docService: 8049,
  scan: 18080,
  fileWatcher: 18081,
} as const;

export const VITE_DEV_PORT = 5173;

export const ENV_KEYS = {
  MODE: 'LAZYMIND_MODE',
  DATA_DIR: 'LAZYMIND_DATA_DIR',
  LOG_LEVEL: 'LAZYMIND_LOG_LEVEL',
  DEV_MODE: 'LAZYMIND_DEV_MODE',
  JWT_SECRET: 'LAZYMIND_JWT_SECRET',
} as const;
