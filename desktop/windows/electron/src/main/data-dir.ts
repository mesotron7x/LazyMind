import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { DataDirPaths } from '../shared/types';
import { DATA_DIR_NAME } from '../shared/constants';
import { getDesktopRoot, getResourcesDir } from './runtime';

let cachedPaths: DataDirPaths | null = null;

export function getDataDir(): DataDirPaths {
  if (cachedPaths) return cachedPaths;

  const desktopRoot = getDesktopRoot();
  const overrideDir = process.env.LAZYMIND_DATA_DIR;
  const root = overrideDir || (desktopRoot ? path.join(desktopRoot, 'data') : path.join(app.getPath('appData'), DATA_DIR_NAME));
  const configPath = desktopRoot ? path.join(desktopRoot, 'config.yaml') : path.join(root, 'config.yaml');
  const logsPath = process.env.LAZYMIND_LOG_DIR || (desktopRoot ? path.join(desktopRoot, 'logs') : path.join(root, 'logs'));

  cachedPaths = {
    root,
    config: configPath,
    data: path.join(root, 'data'),
    vector: path.join(root, 'vector', 'milvus-lite'),
    segment: path.join(root, 'segment'),
    uploads: path.join(root, 'uploads'),
    scanned: path.join(root, 'scanned'),
    cache: path.join(root, 'cache'),
    logs: logsPath,
    diagnostics: path.join(logsPath, 'diagnostics'),
    crash: path.join(logsPath, 'crash'),
    backups: path.join(root, 'backups'),
    defaultDocs: path.join(root, 'default-docs'),
  };

  return cachedPaths;
}

export async function ensureDataDir(): Promise<void> {
  const paths = getDataDir();
  const dirs = [
    paths.root,
    paths.data,
    paths.vector,
    paths.segment,
    paths.uploads,
    paths.scanned,
    paths.cache,
    paths.logs,
    paths.diagnostics,
    paths.crash,
    paths.backups,
    paths.defaultDocs,
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  await copyDefaultDocs(paths.defaultDocs);
  await ensureDefaultConfig(paths.config);
}

async function copyDefaultDocs(targetDir: string): Promise<void> {
  const markerFile = path.join(targetDir, '.initialized');
  try {
    await fs.access(markerFile);
    return;
  } catch {
    // Not initialized yet
  }

  const sourceDir = path.join(getResourcesDir(), 'default-docs');

  try {
    const files = await fs.readdir(sourceDir);
    for (const file of files) {
      await fs.copyFile(path.join(sourceDir, file), path.join(targetDir, file));
    }
    await fs.writeFile(markerFile, new Date().toISOString());
  } catch {
    // Source dir may not exist in early development
  }
}

async function ensureDefaultConfig(configPath: string): Promise<void> {
  try {
    await fs.access(configPath);
  } catch {
    const templatePath = path.join(getResourcesDir(), 'templates', 'default_config.yaml');

    try {
      await fs.copyFile(templatePath, configPath);
    } catch {
      // Template may not exist in early development
    }
  }
}
