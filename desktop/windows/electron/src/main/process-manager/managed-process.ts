import { spawn, ChildProcess, execFile } from 'node:child_process';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import type { ProcessConfig, ProcessState, ProcessInfo, ProcessEvent } from './types';

const ENV_WHITELIST = [
  'PATH', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'HOME',
  'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'COMSPEC',
  'SystemRoot', 'windir', 'OS', 'NUMBER_OF_PROCESSORS',
];

export class ManagedProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private _state: ProcessState = 'pending';
  private _restartCount = 0;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private _startedAt?: number;
  private _healthCheckedAt?: number;
  private _error?: string;

  constructor(private config: ProcessConfig) {
    super();
  }

  get state(): ProcessState { return this._state; }

  async start(): Promise<void> {
    if (this._state === 'starting' || this._state === 'healthy') return;
    this.setState('starting');
    this._error = undefined;

    if (await this.isPortInUse(this.config.port)) {
      this._error = `Port ${this.config.port} is already in use`;
      this.setState('failed');
      return;
    }

    this.spawnProcess();
    this.startHealthCheck();
  }

  async stop(): Promise<void> {
    if (this._state === 'stopped' || this._state === 'stopping') return;
    this.setState('stopping');
    this.stopHealthCheck();

    const child = this.process;
    if (child && this.isProcessAlive(child)) {
      child.kill('SIGTERM');
      const exitedGracefully = await this.waitForExit(child, 5000);
      if (!exitedGracefully && this.isProcessAlive(child)) {
        await this.forceKill(child);
        await this.waitForExit(child, 2000);
      }
    }

    if (this.process === child) {
      this.process = null;
    }
    this.setState('stopped');
  }

  getInfo(): ProcessInfo {
    return {
      name: this.config.name,
      state: this._state,
      port: this.config.port,
      pid: this.process?.pid,
      error: this._error,
      startedAt: this._startedAt,
      healthCheckedAt: this._healthCheckedAt,
      restartCount: this._restartCount,
    };
  }

  private spawnProcess(): void {
    const env: Record<string, string> = {
      ...this.getBaseEnv(),
      ...this.config.env,
      SERVER_HOST: '127.0.0.1',
    };

    const child = spawn(this.config.executablePath, this.config.args || [], {
      cwd: this.config.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });
    this.process = child;

    this._startedAt = Date.now();

    child.stdout?.on('data', (data: Buffer) => {
      this.emitEvent({ type: 'stdout', name: this.config.name, data: data.toString() });
    });

    child.stderr?.on('data', (data: Buffer) => {
      this.emitEvent({ type: 'stderr', name: this.config.name, data: data.toString() });
    });

    child.on('exit', (code, signal) => {
      this.emitEvent({ type: 'exit', name: this.config.name, code, signal });
      if (this.process === child) {
        this.process = null;
      }
      this.handleExit(code, signal);
    });

    child.on('error', (err) => {
      this._error = err.message;
      this.setState('failed');
    });
  }

  private handleExit(code: number | null, _signal: string | null): void {
    if (this._state === 'stopping' || this._state === 'stopped') return;
    this.stopHealthCheck();

    const policy = this.config.restartPolicy || 'on-failure';
    const maxRestarts = this.config.maxRestarts ?? 3;
    const shouldRestart =
      policy === 'always' || (policy === 'on-failure' && code !== 0);

    if (shouldRestart && this._restartCount < maxRestarts) {
      this._restartCount++;
      const delay = Math.min(1000 * Math.pow(2, this._restartCount - 1), 10000);
      setTimeout(() => this.start(), delay);
    } else {
      this._error = `Process exited with code ${code}`;
      this.setState('failed');
    }
  }

  private startHealthCheck(): void {
    const { intervalMs = 2000, retries = 15 } = this.config.healthCheck;
    let attempts = 0;

    this.healthCheckTimer = setInterval(async () => {
      if (this._state !== 'starting') {
        this.stopHealthCheck();
        return;
      }

      const healthy = await this.checkHealth();
      if (healthy) {
        this._healthCheckedAt = Date.now();
        this.setState('healthy');
        this.stopHealthCheck();
        this.startOngoingHealthCheck();
      } else {
        attempts++;
        if (attempts >= retries) {
          this._error = `Health check failed after ${retries} attempts`;
          this.setState('failed');
          this.stopHealthCheck();
        }
      }
    }, intervalMs);
  }

  private startOngoingHealthCheck(): void {
    const { intervalMs = 2000 } = this.config.healthCheck;
    this.healthCheckTimer = setInterval(async () => {
      if (this._state !== 'healthy') {
        this.stopHealthCheck();
        return;
      }
      const healthy = await this.checkHealth();
      if (healthy) {
        this._healthCheckedAt = Date.now();
      } else {
        this._error = 'Health check failed';
        this.setState('failed');
        this.stopHealthCheck();
      }
    }, intervalMs * 5);
  }

  private async checkHealth(): Promise<boolean> {
    const { timeoutMs = 5000 } = this.config.healthCheck;
    if (this.config.healthCheck.type === 'http') {
      return this.httpHealthCheck(timeoutMs);
    }
    return this.tcpHealthCheck(timeoutMs);
  }

  private async httpHealthCheck(timeoutMs: number): Promise<boolean> {
    const url = `http://127.0.0.1:${this.config.port}${this.config.healthCheck.endpoint || '/health'}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  private tcpHealthCheck(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => { socket.destroy(); resolve(false); });
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
      socket.connect(this.config.port, '127.0.0.1');
    });
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private setState(state: ProcessState): void {
    const from = this._state;
    this._state = state;
    this.emitEvent({ type: 'state-change', name: this.config.name, from, to: state });
  }

  private isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(true));
      server.once('listening', () => { server.close(); resolve(false); });
      server.listen(port, '127.0.0.1');
    });
  }

  private getBaseEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const key of ENV_WHITELIST) {
      if (process.env[key]) env[key] = process.env[key]!;
    }
    return env;
  }

  private isProcessAlive(child: ChildProcess): boolean {
    return child.pid !== undefined && child.exitCode === null && child.signalCode === null;
  }

  private async forceKill(child: ChildProcess): Promise<void> {
    if (process.platform === 'win32' && child.pid !== undefined) {
      await new Promise<void>((resolve) => {
        execFile(
          'taskkill',
          ['/T', '/F', '/PID', String(child.pid)],
          { windowsHide: true },
          () => resolve(),
        );
      });
      return;
    }
    child.kill('SIGKILL');
  }

  private waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isProcessAlive(child)) { resolve(true); return; }
      const timeout = setTimeout(() => {
        child.off('exit', onExit);
        resolve(false);
      }, timeoutMs);
      const onExit = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      child.once('exit', onExit);
    });
  }

  private emitEvent(event: ProcessEvent): void {
    this.emit('event', event);
  }
}
