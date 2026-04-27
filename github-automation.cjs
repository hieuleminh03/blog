const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

(async () => {
  console.log('Launching CocCoc with original profile...');
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

  await new Promise(r => setTimeout(r, 2000));

  // Check if we got redirected to login (not logged in)
  if (page.url().includes('login')) {
    console.error('Not logged in to GitHub!');
    await page.screenshot({ path: '/home/yian/projects/blog/screenshot-error-login.png', fullPage: true });
    await browser.close();
    process.exit(1);
  }

  console.log('On new repo page, filling form...');

  // Fill repo name
  await page.waitForSelector('input[name="repository[name]"], input[data-testid="repository-name-input"], #repository_name', { timeout: 10000 });
  const nameInput = await page.$('input[name="repository[name]"], input[data-testid="repository-name-input"], #repository_name');
  await nameInput.click();
  await nameInput.type('blog');
  console.log('Typed repo name: blog');

  await new Promise(r => setTimeout(r, 1500));

  // Click Create repository button
  const createBtn = await page.$('button[type="submit"].btn-primary, button[data-testid="create-repository-button"]');
  if (createBtn) {
    await createBtn.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await createBtn.click();
    console.log('Clicked create repo button');
  } else {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
      for (const b of btns) {
        if (b.textContent.includes('Create repository')) {
          b.scrollIntoView({ behavior: 'instant', block: 'center' });
          b.click();
          return;
        }
      }
    });
    console.log('Clicked create repo button via evaluate');
  }

  console.log('Waiting for repo creation...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
  console.log('Repo created, URL:', page.url());

  await page.screenshot({ path: '/home/yian/projects/blog/screenshot-repo-created.png', fullPage: true });

  await browser.close();
  console.log('Browser closed. Now pushing code via git...');

  // Git operations
  const repoDir = '/home/yian/projects/blog';
  try {
    execSync('git init', { cwd: repoDir, stdio: 'inherit' });
  } catch (e) {}

  try {
    execSync('git remote remove origin', { cwd: repoDir, stdio: 'inherit' });
  } catch (e) {}

  execSync('git remote add origin git@github.com:hieuleminh03/blog.git', { cwd: repoDir, stdio: 'inherit' });
  execSync('git add .', { cwd: repoDir, stdio: 'inherit' });

  try {
    execSync('git commit -m "Initial commit"', { cwd: repoDir, stdio: 'inherit' });
  } catch (e) {
    console.log('Commit may have failed or nothing to commit');
  }

  execSync('git branch -M main', { cwd: repoDir, stdio: 'inherit' });
  execSync('git push -u origin main --force', { cwd: repoDir, stdio: 'inherit' });

  console.log('Code pushed!');

  // Enable GitHub Pages
  console.log('Enabling GitHub Pages...');
  const browser2 = await puppeteer.launch({
    executablePath: '/usr/bin/coccoc-browser-stable',
    userDataDir: '/home/yian/.config/coccoc-browser',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  const page2 = await browser2.newPage();
  await page2.goto('https://github.com/hieuleminh03/blog/settings/pages', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  // Look for the source select dropdown or button
  const sourceSelect = await page2.$('select#source, [data-testid="pages-source-select"], select[name="source"]');
  if (sourceSelect) {
    await sourceSelect.select('branch');
    console.log('Selected branch source');
  }

  await new Promise(r => setTimeout(r, 1000));

  // Look for branch select (main)
  const branchSelect = await page2.$('select#branch, [data-testid="pages-branch-select"], select[name="branch"]');
  if (branchSelect) {
    await branchSelect.select('main');
    console.log('Selected main branch');
  }

  await new Promise(r => setTimeout(r, 1000));

  // Look for save button
  const saveBtn = await page2.$('button[type="submit"].btn-primary, button:has-text("Save"), [data-testid="save-pages-settings"]');
  if (saveBtn) {
    await saveBtn.click();
    console.log('Clicked save');
  } else {
    await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        if (b.textContent.trim().toLowerCase() === 'save') {
          b.click();
          return;
        }
      }
    });
    console.log('Clicked save via evaluate');
  }

  await new Promise(r => setTimeout(r, 3000));
  await page2.screenshot({ path: '/home/yian/projects/blog/screenshot-pages-enabled.png', fullPage: true });

  await browser2.close();
  console.log('GitHub Pages enabled!');
  console.log('Your site will be available at: https://hieuleminh03.github.io/blog');
})();
