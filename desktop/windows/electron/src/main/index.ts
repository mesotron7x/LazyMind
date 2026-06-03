import { app, Menu } from 'electron';
import { registerSchemeAsPrivileged, registerProtocolHandler } from './protocol';
import { createMainWindow, createSplashWindow } from './window';
import { ensureDataDir } from './data-dir';
import { registerAllIPCHandlers, setProcessManagerRef } from './ipc/handlers';
import { initLifecycle } from './lifecycle';
import { createProcessManager, getProcessConfigs } from './process-manager';
import { createProxyServer, getDefaultRoutes, generateLocalSecret } from './proxy';
import { createAssistantManager } from './assistant-manager';
import { DEFAULT_PORTS, PROTOCOL_SCHEME } from '../shared/constants';
import type { ProcessManager } from './process-manager';
import type { ProxyServer } from './proxy';

let processManager: ProcessManager | null = null;
let proxyServer: ProxyServer | null = null;

registerSchemeAsPrivileged();

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

  const configs = getProcessConfigs();
  processManager = createProcessManager(configs);
  setProcessManagerRef(processManager);

  processManager.startAll().then(() => {
    const assistantManager = createAssistantManager(proxyServer!);
    assistantManager.initialize().catch((err) => {
      console.error('Failed to initialize assistant manager:', err);
    });
  }).catch((err) => {
    console.error('Failed to start services:', err);
  });

  const mainWindow = createMainWindow();
  mainWindow.once('ready-to-show', () => {
    splash.close();
    mainWindow.show();
  });

  initLifecycle(mainWindow, processManager, proxyServer);
});
