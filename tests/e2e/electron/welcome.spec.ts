import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer } from '../electron-utils';

test('electron welcome screen shows the primary actions', async () => {
  const launched = await launchElectronApp();
  try {
    const deadline = Date.now() + 45_000;
    let welcome = launched.window;
    let found = false;
    while (Date.now() < deadline) {
      for (const candidate of launched.app.windows()) {
        const text = await candidate.locator('body').innerText().catch(() => '');
        if (text.includes('Create New Project') && text.includes('Open Existing Project')) {
          welcome = candidate;
          found = true;
          break;
        }
      }
      if (found) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(found, `welcome text missing. urls=${launched.app.windows().map((window) => window.url()).join(' | ')}`).toBe(true);
    await expect(welcome.getByText('Create New Project')).toBeVisible();
    await expect(welcome.getByText('Open Existing Project')).toBeVisible();
  } finally {
    await launched.app.close();
    await stopViteServer(launched.viteProcess);
  }
});
