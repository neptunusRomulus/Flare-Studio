const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/');
  await page.click('button:has-text("Create New Project")');
  const heading = await page.locator('h2:has-text("Create a New Flare Project")').count();
  const inputs = await page.$$eval('input', els => els.map(el => ({placeholder: el.placeholder, readonly: el.readOnly, value: el.value}))); 
  const folderButtons = await page.$$eval('div:has(input[placeholder="Select folder for your project"]) button', els => els.map(el => el.outerHTML));
  console.log('heading matches', heading);
  console.log('inputs', JSON.stringify(inputs, null, 2));
  console.log('folderButtons', folderButtons.length);
  console.log('folder button html', folderButtons[0]);
  await browser.close();
})();
