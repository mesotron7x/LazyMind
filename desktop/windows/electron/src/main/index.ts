import { app, Menu } from 'electron';
import { registerSchemeAsPrivileged, registerProtocolHandler } from './protocol';
import { createMainWindow, createSplashWindow } from './window';
import { ensureDataDir } from './data-dir';
import { registerAllIPCHandlers, setAssistantManagerRef, setProcessManagerRef } from './ipc/handlers';
import { initLifecycle } from './lifecycle';
import { createProcessManager, getProcessConfigs } from './process-manager';
import { createProxyServer, getDefaultRoutes, generateLocalSecret } from './proxy';
import { createAssistantManager } from './assistant-manager';
import { DEFAULT_PORTS, PROTOCOL_SCHEME } from '../shared/constants';
import type { ProcessManager } from './process-manager';
import type { ProxyServer } from './proxy';
import type { AssistantManager } from './assistant-manager';

let processManager: ProcessManager | null = null;
let proxyServer: ProxyServer | null = null;
let assistantManager: AssistantManager | null = null;

registerSchemeAsPrivileged();

if (process.platform === 'win32') {
  app.setAppUserModelId('com.lazymind.desktop');
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);

    registerProtocolHandler();

    await ensureDataDir();

    registerAllIPCHandlers();

    const splash = createSplashWindow();

    const localSecret = generateLocalSecret();
    proxyServer = createProxyServer({
      port: DEFAULT_PORTS.proxy,
      host: '127.0.0.1',
      routes: getDefaultRoutes(),
      localSecret,
      allowedOrigins: [
        `${PROTOCOL_SCHEME}://app`,
        'http://localhost:5173',
      ],
    });

    await proxyServer.start();

    const initializeAssistant = async () => {
      assistantManager = createAssistantManager(proxyServer!);
      setAssistantManagerRef(assistantManager);
      await assistantManager.initialize();
    };

    const configs = getProcessConfigs();
    processManager = createProcessManager(configs);
    setProcessManagerRef(processManager);

    try {
      await processManager.start('core');
      await waitForServiceHealthy(processManager, 'core', 30000);
      await initializeAssistant();
      void processManager.startAll().catch((err) => {
        console.error('Failed to start background services:', err);
      });
    } catch (err) {
      console.error('Failed to start required services:', err);
    }

    const mainWindow = createMainWindow();
    mainWindow.once('ready-to-show', () => {
      splash.close();
      mainWindow.show();
    });

    initLifecycle(mainWindow, processManager, proxyServer);
  });
}

function waitForServiceHealthy(manager: ProcessManager, name: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const info = manager.getInfo(name);
      if (info?.state === 'healthy') {
        clearInterval(timer);
        resolve();
        return;
      }
      if (info?.state === 'failed') {
        clearInterval(timer);
        reject(new Error(`Service ${name} failed: ${info.error || 'unknown error'}`));
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for ${name}`));
      }
    }, 300);
  });
}
