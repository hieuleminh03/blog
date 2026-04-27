const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching CocCoc with copied profile...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/coccoc-browser-stable',
    userDataDir: '/tmp/coccoc-puppeteer',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });

  const page = await browser.newPage();

  console.log('Navigating to github.com...');
  await page.goto('https://github.com', { waitUntil: 'networkidle2', timeout: 60000 });

  await new Promise(r => setTimeout(r, 3000));

  // Check if logged in by looking for avatar or sign out link
  const avatar = await page.$('img.avatar, [data-testid="header-avatar"], .Header-link[href="/logout"]');
  const bodyText = await page.evaluate(() => document.body.innerText);
  const isLoggedIn = bodyText.includes('Your repositories') || bodyText.includes('Dashboard') || avatar !== null;

  console.log('Logged in:', isLoggedIn);
  console.log('Page title:', await page.title());

  await page.screenshot({ path: '/home/yian/projects/blog/screenshot-github-home.png', fullPage: true });
  console.log('Screenshot saved: screenshot-github-home.png');

  await browser.close();
})();
