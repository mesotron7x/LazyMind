export type ProcessState = 'pending' | 'starting' | 'healthy' | 'stopping' | 'stopped' | 'failed';

export interface HealthCheckConfig {
  type: 'http' | 'tcp';
  endpoint?: string;
  intervalMs?: number;
  timeoutMs?: number;
  retries?: number;
}

export interface ProcessConfig {
  name: string;
  executablePath: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  healthCheck: HealthCheckConfig;
  port: number;
  dependsOn?: string[];
  startupTimeout?: number;
  restartPolicy?: 'always' | 'on-failure' | 'never';
  maxRestarts?: number;
}

export interface ProcessInfo {
  name: string;
  state: ProcessState;
  port: number;
  pid?: number;
  error?: string;
  startedAt?: number;
  healthCheckedAt?: number;
  restartCount: number;
}

export type ProcessEvent =
  | { type: 'state-change'; name: string; from: ProcessState; to: ProcessState }
  | { type: 'stdout'; name: string; data: string }
  | { type: 'stderr'; name: string; data: string }
  | { type: 'exit'; name: string; code: number | null; signal: string | null };
