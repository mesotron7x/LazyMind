import { app } from 'electron';
import path from 'node:path';

export function getDesktopRoot(): string | null {
  const root = process.env.LAZYMIND_DESKTOP_ROOT;
  return root ? path.resolve(root) : null;
}

export function isPortableRuntime(): boolean {
  return getDesktopRoot() !== null;
}

export function isLauncherManagedCore(): boolean {
  return process.env.LAZYMIND_LAUNCHER_MANAGED_CORE === '1';
}

export function getRendererDir(): string {
  const overrideDir = process.env.ELECTRON_RENDERER_DIR;
  if (overrideDir) return path.resolve(overrideDir);

  const desktopRoot = getDesktopRoot();
  if (desktopRoot) return path.join(desktopRoot, 'renderer');

  if (app.isPackaged) return path.join(process.resourcesPath, 'renderer');

  return path.resolve(__dirname, '../../../../../../frontend/dist');
}

export function getResourcesDir(): string {
  const desktopRoot = getDesktopRoot();
  if (desktopRoot) return path.join(desktopRoot, 'resources');

  if (app.isPackaged) return process.resourcesPath;

  return path.resolve(__dirname, '../../../../resources');
}
