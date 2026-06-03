import { BrowserWindow } from 'electron';
import { ManagedProcess } from './managed-process';
import type { ProcessConfig, ProcessInfo } from './types';

export interface ProcessManager {
  start(name: string): Promise<void>;
  stop(name: string): Promise<void>;
  restart(name: string): Promise<void>;
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
  getInfo(name: string): ProcessInfo | undefined;
  getAllInfo(): Record<string, ProcessInfo>;
  onStateChange(callback: (name: string, info: ProcessInfo) => void): () => void;
}

export function createProcessManager(configs: ProcessConfig[]): ProcessManager {
  const processes = new Map<string, ManagedProcess>();
  const listeners: ((name: string, info: ProcessInfo) => void)[] = [];

  for (const config of configs) {
    const proc = new ManagedProcess(config);
    processes.set(config.name, proc);

    proc.on('event', (event) => {
      if (event.type === 'state-change') {
        const info = proc.getInfo();
        listeners.forEach((cb) => cb(event.name, info));
        broadcastToRenderer();
      }
    });
  }

  function broadcastToRenderer(): void {
    const statuses = getAllInfo();
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('service:status-changed', statuses);
      }
    });
  }

  function getAllInfo(): Record<string, ProcessInfo> {
    const result: Record<string, ProcessInfo> = {};
    for (const [name, proc] of processes) {
      result[name] = proc.getInfo();
    }
    return result;
  }

  async function startAll(): Promise<void> {
    const sorted = topologicalSort(configs);
    for (const batch of sorted) {
      await Promise.all(batch.map((name) => startWithDeps(name)));
    }
  }

  async function startWithDeps(name: string): Promise<void> {
    const proc = processes.get(name);
    if (!proc) return;
    if (proc.state === 'healthy' || proc.state === 'starting') return;

    const config = configs.find((c) => c.name === name)!;
    for (const dep of config.dependsOn || []) {
      const depProc = processes.get(dep);
      if (depProc && depProc.state !== 'healthy') {
        await startWithDeps(dep);
        await waitForState(dep, 'healthy', config.startupTimeout || 30000);
      }
    }

    await proc.start();
  }

  async function start(name: string): Promise<void> {
    await startWithDeps(name);
  }

  async function stop(name: string): Promise<void> {
    const proc = processes.get(name);
    if (proc) await proc.stop();
  }

  async function stopAll(): Promise<void> {
    const sorted = topologicalSort(configs);
    const reversed = [...sorted].reverse();
    for (const batch of reversed) {
      await Promise.all(batch.map((name) => stop(name)));
    }
  }

  async function restart(name: string): Promise<void> {
    await stop(name);
    await startWithDeps(name);
  }

  function getInfo(name: string): ProcessInfo | undefined {
    return processes.get(name)?.getInfo();
  }

  function waitForState(name: string, target: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = processes.get(name);
      if (!proc) { reject(new Error(`Unknown service: ${name}`)); return; }
      if (proc.state === target) { resolve(); return; }
      if (proc.state === 'failed') { reject(new Error(`Service ${name} failed`)); return; }

      const start = Date.now();
      const check = setInterval(() => {
        if (proc.state === target) { clearInterval(check); resolve(); }
        else if (proc.state === 'failed') { clearInterval(check); reject(new Error(`Service ${name} failed`)); }
        else if (Date.now() - start > timeoutMs) { clearInterval(check); reject(new Error(`Timeout waiting for ${name}`)); }
      }, 300);
    });
  }

  return {
    start, stop, restart, startAll, stopAll, getInfo, getAllInfo,
    onStateChange: (cb) => {
      listeners.push(cb);
      return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
    },
  };
}

function topologicalSort(configs: ProcessConfig[]): string[][] {
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const c of configs) {
    inDegree.set(c.name, (c.dependsOn || []).length);
    if (!dependents.has(c.name)) dependents.set(c.name, []);
    for (const dep of c.dependsOn || []) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(c.name);
    }
  }

  const result: string[][] = [];
  const remaining = new Set(configs.map((c) => c.name));

  while (remaining.size > 0) {
    const batch = [...remaining].filter((name) => (inDegree.get(name) || 0) === 0);
    if (batch.length === 0) throw new Error('Circular dependency detected');
    result.push(batch);
    for (const name of batch) {
      remaining.delete(name);
      for (const dep of dependents.get(name) || []) {
        inDegree.set(dep, (inDegree.get(dep) || 0) - 1);
      }
    }
  }

  return result;
}
