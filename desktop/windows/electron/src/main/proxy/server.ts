import http from 'node:http';
import net from 'node:net';
import httpProxy from 'http-proxy';
import { randomUUID, randomBytes } from 'node:crypto';
import { DEFAULT_PORTS, PROTOCOL_SCHEME } from '../../shared/constants';

export interface ProxyRoute {
  prefix: string;
  target: string;
  stripPrefix?: boolean;
  timeout?: number;
}

export interface ProxyConfig {
  port: number;
  host: string;
  routes: ProxyRoute[];
  localSecret: string;
  allowedOrigins: string[];
}

export interface ProxyServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  getPort(): number;
  setCurrentAssistant(userId: string, userName: string): void;
  isRunning(): boolean;
}

export function createProxyServer(config: ProxyConfig): ProxyServer {
  const proxy = httpProxy.createProxyServer({
    xfwd: false,
    changeOrigin: false,
    followRedirects: false,
  });

  let currentUserId = '';
  let currentUserName = '';
  let server: http.Server | null = null;
  let running = false;
  const sockets = new Set<net.Socket>();

  proxy.on('proxyRes', (proxyRes, _req, res) => {
    const contentType = proxyRes.headers['content-type'] || '';
    if (contentType.includes('text/event-stream')) {
      res.flushHeaders();
    }
  });

  proxy.on('error', (err, _req, res) => {
    if (res && 'writeHead' in res && !res.headersSent) {
      (res as http.ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
      (res as http.ServerResponse).end(JSON.stringify({
        error: 'Service unavailable',
        message: 'Local backend service is not ready. Please wait for services to start.',
      }));
    }
  });

  function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = req.headers.origin || '';
    if (!isAllowedOrigin(origin, config.allowedOrigins)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden origin' }));
      return;
    }

    setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const route = matchRoute(req.url || '', config.routes);
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', message: 'No matching route' }));
      return;
    }

    let targetPath = req.url || '';
    if (route.stripPrefix) {
      targetPath = targetPath.slice(route.prefix.length) || '/';
    }

    req.headers['x-user-id'] = currentUserId;
    req.headers['x-user-name'] = currentUserName;
    req.headers['x-desktop-secret'] = config.localSecret;
    req.headers['x-request-id'] = randomUUID();

    if (route.stripPrefix && targetPath !== req.url) {
      req.url = targetPath;
    }

    proxy.web(req, res, {
      target: route.target,
      timeout: route.timeout || 30000,
      proxyTimeout: route.timeout || 30000,
      headers: { host: new URL(route.target).host },
    }, (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Service unavailable',
          message: `Cannot connect to ${route.prefix}: ${err.message}`,
        }));
      }
    });

  }

  return {
    start(): Promise<void> {
      return new Promise((resolve, reject) => {
        server = http.createServer(handleRequest);
        server.on('error', reject);
        server.on('connection', (socket) => {
          sockets.add(socket);
          socket.on('close', () => sockets.delete(socket));
        });
        server.listen(config.port, config.host, () => {
          running = true;
          resolve();
        });

        server.on('upgrade', (req, socket, head) => {
          const route = matchRoute(req.url || '', config.routes);
          if (route) {
            proxy.ws(req, socket, head, { target: route.target });
          } else {
            socket.destroy();
          }
        });
      });
    },

    stop(): Promise<void> {
      return new Promise((resolve) => {
        running = false;
        proxy.close();

        const activeServer = server;
        server = null;
        if (!activeServer) {
          resolve();
          return;
        }

        let resolved = false;
        const finish = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(forceClose);
          resolve();
        };
        const forceClose = setTimeout(() => {
          activeServer.closeAllConnections?.();
          for (const socket of sockets) {
            socket.destroy();
          }
          finish();
        }, 2000);

        activeServer.close(finish);
        activeServer.closeIdleConnections?.();
      });
    },

    getPort(): number {
      return config.port;
    },

    setCurrentAssistant(userId: string, userName: string): void {
      currentUserId = userId;
      currentUserName = userName;
    },

    isRunning(): boolean {
      return running;
    },
  };
}

function matchRoute(url: string, routes: ProxyRoute[]): ProxyRoute | undefined {
  const sortedRoutes = [...routes].sort((a, b) => b.prefix.length - a.prefix.length);
  return sortedRoutes.find((route) => url.startsWith(route.prefix));
}

function isAllowedOrigin(origin: string, allowed: string[]): boolean {
  if (!origin) return true;
  return allowed.some((a) => origin === a || origin.startsWith(`${PROTOCOL_SCHEME}://`));
}

function setCorsHeaders(res: http.ServerResponse, origin: string): void {
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-Request-Id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

export function getDefaultRoutes(): ProxyRoute[] {
  return [
    { prefix: '/api/authservice', target: `http://127.0.0.1:${DEFAULT_PORTS.auth}`, stripPrefix: false, timeout: 30000 },
    { prefix: '/api/core', target: `http://127.0.0.1:${DEFAULT_PORTS.core}`, stripPrefix: true, timeout: 600000 },
    { prefix: '/api/chat', target: `http://127.0.0.1:${DEFAULT_PORTS.chat}`, stripPrefix: false, timeout: 600000 },
    { prefix: '/api/algo', target: `http://127.0.0.1:${DEFAULT_PORTS.parsing}`, stripPrefix: false, timeout: 600000 },
    { prefix: '/api/parsing', target: `http://127.0.0.1:${DEFAULT_PORTS.processor}`, stripPrefix: false, timeout: 600000 },
    { prefix: '/api/scan', target: `http://127.0.0.1:${DEFAULT_PORTS.scan}`, stripPrefix: false, timeout: 30000 },
    { prefix: '/api/file', target: `http://127.0.0.1:${DEFAULT_PORTS.fileWatcher}`, stripPrefix: false, timeout: 30000 },
  ];
}

export function generateLocalSecret(): string {
  return randomBytes(32).toString('hex');
}
