const fs = require('fs');
const path = require('path');
const { _electron: electron } = require('@playwright/test');

(async () => {
  const VITE_HOST = '127.0.0.1';
  const VITE_PORT = 5173;
  const VITE_URL = `http://${VITE_HOST}:${VITE_PORT}`;
  const waitOn = require('wait-on');
  const projectRoot = path.join(require('os').tmpdir(), 'PlaywrightItemEnemyInspect');
  const projectName = `Inspect Enemy Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;
  if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(path.join(projectPath, 'settings.txt'), 'description=Inspect enemy dialog\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n', 'utf8');
  const mapData = { name: projectName, width: 16, height: 16, tileSize: 16, layers: [ { id: 1, name: 'Ground', type: 'background', data: Array(16 * 16).fill(0), visible: true }, { id: 2, name: 'Enemy', type: 'enemy', data: Array(16 * 16).fill(0), visible: true } ], tilesets: [], version: '1.0' };
  fs.writeFileSync(path.join(projectPath, mapFileName), JSON.stringify(mapData, null, 2), 'utf8');

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const child = require('child_process').spawn(npx, ['vite', '--host', VITE_HOST, '--port', String(VITE_PORT)], { cwd: path.resolve(__dirname, '..'), shell: false, stdio: 'inherit' });
  await waitOn({ resources: [VITE_URL], timeout: 30000, interval: 500, tcpTimeout: 1000 });
  const app = await electron.launch({ args: ['.'] });
  const window = await (async () => {
    const existing = app.windows().find(w => { const url = w.url(); return url && !url.startsWith('devtools://') && !url.startsWith('about:blank'); });
    if (existing) return existing;
    while (true) {
      const next = await app.waitForEvent('window');
      const url = next.url();
      if (url && !url.startsWith('devtools://') && !url.startsWith('about:blank')) return next;
    }
  })();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForLoadState('load');

  await window.evaluate(async (projectPath) => {
    window.__selectedPath = projectPath;
  }, projectPath);
  await app.evaluate(async ({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [window.__selectedPath] });
  });

  await window.getByRole('button', { name: /Open Existing Project/i }).click();
  await window.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  const showSidebarButton = window.getByRole('button', { name: /Show sidebar/i });
  if (await showSidebarButton.count() > 0) await showSidebarButton.click();
  await window.locator('div[role="button"]', { hasText: /^Enemy$/ }).first().click();
  await window.getByRole('button', { name: 'Add Enemy' }).click();
  const dialog = window.locator('div:has(h3:has-text("Add Enemy"))').first();
  console.log('button count', await dialog.locator('button').count());
  console.log('button texts', await dialog.locator('button').allTextContents());
  console.log('name placeholder count', await dialog.locator('input[placeholder="Goblin Scout"]').count());
  console.log('name value before fill', await dialog.locator('input[placeholder="Goblin Scout"]').inputValue());
  await dialog.locator('input[placeholder="Goblin Scout"]').fill('Test Enemy');
  console.log('name value after fill', await dialog.locator('input[placeholder="Goblin Scout"]').inputValue());
  await dialog.locator('button').nth(1).click();
  await new Promise(res => setTimeout(res, 2000));
  console.log('dialog still count', await window.locator('div:has(h3:has-text("Add Enemy"))').count());
  await app.close();
  child.kill();
})();
