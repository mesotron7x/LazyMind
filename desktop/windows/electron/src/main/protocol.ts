import { app, protocol, net } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROTOCOL_SCHEME } from '../shared/constants';

export function registerSchemeAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false,
        stream: true,
      },
    },
  ]);
}

export function registerProtocolHandler(): void {
  const rendererDir = getRendererDir();

  protocol.handle(PROTOCOL_SCHEME, (request) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);

    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }

    if (!filePath || filePath === '/') {
      filePath = 'index.html';
    }

    const resolvedPath = path.join(rendererDir, filePath);
    const normalizedResolved = path.normalize(resolvedPath);

    if (!normalizedResolved.startsWith(path.normalize(rendererDir))) {
      return new Response('Forbidden', { status: 403 });
    }

    const fileUrl = pathToFileURL(normalizedResolved).href;

    return net.fetch(fileUrl).catch(() => {
      const indexPath = pathToFileURL(path.join(rendererDir, 'index.html')).href;
      return net.fetch(indexPath);
    });
  });
}

export function getRendererURL(route: string = '/'): string {
  if (!app.isPackaged) {
    const devPort = process.env.VITE_DEV_PORT || '5173';
    return `http://localhost:${devPort}${route}`;
  }
  return `${PROTOCOL_SCHEME}://app${route}`;
}

function getRendererDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'renderer');
  }
  // Development: expect frontend/dist relative to project root
  return path.join(__dirname, '../../../../../../frontend/dist');
}
