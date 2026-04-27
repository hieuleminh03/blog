const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, 'dist');
const out = path.join(__dirname, 'screenshots');

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}

function resolveFile(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://local.test').pathname);
  const requested = path.normalize(path.join(root, pathname));
  if (!requested.startsWith(root)) return null;
  if (fs.existsSync(requested) && fs.statSync(requested).isFile()) return requested;
  const index = path.join(requested, 'index.html');
  if (fs.existsSync(index)) return index;
  return path.join(root, '404.html');
}

async function main() {
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    throw new Error('Run `npm run build` before `npm run screenshot`.');
  }

  fs.mkdirSync(out, { recursive: true });

  const server = http.createServer((req, res) => {
    const file = resolveFile(req.url);
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(file.endsWith('404.html') ? 404 : 200, { 'content-type': contentType(file) });
    fs.createReadStream(file).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    for (const [name, route] of [['home', '/'], ['thoughts', '/thoughts/'], ['projects', '/projects/']]) {
      await page.goto(base + route, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
      console.log(`Captured screenshots/${name}.png`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
