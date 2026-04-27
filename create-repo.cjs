const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Launching CocCoc browser...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/coccoc-browser-stable',
    userDataDir: '/home/yian/.config/coccoc-browser',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  const page = await browser.newPage();

  console.log('Navigating to github.com/new...');
  await page.goto('https://github.com/new', { waitUntil: 'networkidle2', timeout: 60000 });

  // Take screenshot to verify state
  await page.screenshot({ path: '/home/yian/projects/blog/screenshot-1-new-repo.png', fullPage: true });
  console.log('Screenshot saved: screenshot-1-new-repo.png');

  // Wait for repo name input
  await page.waitForSelector('input[name="repository[name]"], input[data-testid="repository-name-input"], #repository_name', { timeout: 10000 });
  console.log('Repo name input found');

  // Fill repo name
  const nameInput = await page.$('input[name="repository[name]"], input[data-testid="repository-name-input"], #repository_name');
  await nameInput.click();
  await nameInput.type('blog');
  console.log('Typed repo name: blog');

  await page.waitForTimeout(1000);

  // Ensure public is selected (it usually is by default)
  const publicRadio = await page.$('input[name="repository[visibility]"][value="public"], input#repository_visibility_public');
  if (publicRadio) {
    await publicRadio.evaluate(el => el.scrollIntoView());
    await publicRadio.click();
    console.log('Selected public visibility');
  }

  // Wait a moment for validation
  await page.waitForTimeout(1500);

  // Click Create repository
  const createBtn = await page.$('button[type="submit"].btn-primary, button[data-testid="create-repository-button"], button:has-text("Create repository")');
  if (!createBtn) {
    console.log('Create button not found, trying alternate selectors...');
  }
  // Try multiple selectors
  const btnSelectors = [
    'button[type="submit"].btn-primary',
    'button[data-testid="create-repository-button"]',
    'button.btn-primary:has(> span:contains("Create repository"))',
    'form#new_repository button[type="submit"]',
  ];
  let clicked = false;
  for (const sel of btnSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
        await btn.click();
        clicked = true;
        console.log('Clicked create repo button with selector:', sel);
        break;
      }
    } catch (e) {}
  }

  if (!clicked) {
    // Use page.evaluate to find and click
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
      for (const b of btns) {
        if (b.textContent.includes('Create repository')) {
          b.scrollIntoView({ behavior: 'instant', block: 'center' });
          b.click();
          return true;
        }
      }
      return false;
    });
    console.log('Clicked create repo button via evaluate');
  }

  // Wait for navigation to the new repo page
  console.log('Waiting for repo creation...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
  console.log('Repo created, URL:', page.url());

  await page.screenshot({ path: '/home/yian/projects/blog/screenshot-2-repo-created.png', fullPage: true });
  console.log('Screenshot saved: screenshot-2-repo-created.png');

  await browser.close();
  console.log('Done!');
})();
