import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import waitOn from 'wait-on';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

const VITE_HOST = '127.0.0.1';
const VITE_PORT = 5173;
const VITE_URL = `http://${VITE_HOST}:${VITE_PORT}`;

export async function startViteServer(): Promise<ChildProcess | null> {
  const rootDir = path.resolve(__dirname, '..');

  try {
    await waitOn({ resources: [VITE_URL], timeout: 5000, interval: 500, tcpTimeout: 1000 });
    return null;
  } catch {
    // Port 5173 is not serving yet, start a local Vite process
  }

  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const viteProcess = spawn(
    npxCommand,
    ['vite', '--host', VITE_HOST, '--port', String(VITE_PORT)],
    {
      cwd: rootDir,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORCE_COLOR: '0',
      },
    }
  );

  viteProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    if (text.trim()) {
      console.log(`[VITE] ${text.trim()}`);
    }
  });

  viteProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    if (text.trim()) {
      console.error(`[VITE ERR] ${text.trim()}`);
    }
  });

  await waitOn({ resources: [VITE_URL], timeout: 30000, interval: 500, tcpTimeout: 1000 });
  return viteProcess;
}

export async function stopViteServer(viteProcess: ChildProcess | null): Promise<void> {
  if (!viteProcess || viteProcess.killed) return;
  return new Promise((resolve) => {
    viteProcess.once('exit', resolve);
    viteProcess.kill();
    setTimeout(resolve, 5000);
  });
}

export async function launchElectronApp(): Promise<{ app: ElectronApplication; window: Page; viteProcess: ChildProcess | null }> {
  const viteProcess = await startViteServer();
  const app = await electron.launch({ args: ['.'] });
  const window = await getAppWindow(app);
  return { app, window, viteProcess };
}

export async function getAppWindow(electronApp: ElectronApplication): Promise<Page> {
  const getMainWindow = () => {
    return electronApp.windows().find((w) => {
      const url = w.url();
      return url && !url.startsWith('devtools://') && !url.startsWith('about:blank');
    });
  };

  const existing = getMainWindow();
  if (existing) return existing;

  while (true) {
    const next = await electronApp.waitForEvent('window');
    const url = next.url();
    if (url && !url.startsWith('devtools://') && !url.startsWith('about:blank')) {
      return next;
    }
  }
}
