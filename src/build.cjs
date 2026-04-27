const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'content');

function normalizeRoute(route) {
  if (!route || route === '/') return '/';
  return `/${route.replace(/^\/+|\/+$/g, '')}`;
}

function routeDir(route) {
  return normalizeRoute(route) === '/' ? '' : normalizeRoute(route).slice(1);
}

function outputFile(route) {
  return normalizeRoute(route) === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, routeDir(route), 'index.html');
}

function relativeAssetPrefix(route) {
  const depth = routeDir(route).split('/').filter(Boolean).length;
  return depth === 0 ? 'assets' : `${'../'.repeat(depth)}assets`;
}

function relativeRoute(fromRoute, toRoute) {
  const from = routeDir(fromRoute);
  const to = routeDir(toRoute);
  let rel = path.posix.relative(from, to);
  if (!rel) rel = '.';
  return `${rel}/`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function parseFrontmatter(source) {
  if (!source.startsWith('---\n')) return { data: {}, body: source };
  const end = source.indexOf('\n---', 4);
  if (end === -1) return { data: {}, body: source };

  const raw = source.slice(4, end).trim();
  const bodyStart = source.indexOf('\n', end + 4);
  const body = bodyStart === -1 ? '' : source.slice(bodyStart + 1);
  const data = {};

  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) data[match[1]] = parseScalar(match[2]);
  }

  return { data, body };
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'post';
}

function formatDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : text;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function readMarkdown(file) {
  const source = await fs.readFile(file, 'utf8');
  return parseFrontmatter(source);
}

async function renderMarkdown(marked, markdown) {
  const html = await marked.parse(markdown);
  return html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a target="_blank" rel="noopener noreferrer" href="$1"');
}

async function loadPage(marked, file, fallbackTitle) {
  const { data, body } = await readMarkdown(file);
  const title = data.title || fallbackTitle;
  return {
    title,
    article: `<h1>${escapeHtml(title)}</h1>\n${await renderMarkdown(marked, body)}`,
  };
}

async function loadPosts(marked) {
  const postsDir = path.join(CONTENT, 'posts');
  await fs.mkdir(postsDir, { recursive: true });
  const files = (await fs.readdir(postsDir)).filter((file) => file.endsWith('.md')).sort();
  const posts = [];

  for (const file of files) {
    const fullPath = path.join(postsDir, file);
    const { data, body } = await readMarkdown(fullPath);
    if (data.draft) continue;

    const title = data.title || file.replace(/\.md$/, '');
    const slug = data.slug || slugify(file.replace(/\.md$/, ''));
    const date = data.date || '';
    posts.push({
      title,
      slug,
      date: String(date),
      displayDate: formatDate(date),
      description: data.description || '',
      route: `/thoughts/${slug}`,
      article: `<h1>${escapeHtml(title)}</h1>\n${await renderMarkdown(marked, body)}`,
    });
  }

  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return posts;
}

function thoughtsIndex(posts) {
  if (!posts.length) {
    return '<p class="mt">No posts yet.</p>';
  }

  const items = posts.map((post) => {
    return `<li><a class="post-row" href="${post.slug}/"><span>${escapeHtml(post.title)}</span><span class="dot-leaders"></span><time>${escapeHtml(post.displayDate)}</time></a></li>`;
  }).join('');

  return `<div><ul class="post-list">${items}</ul></div>`;
}

function nav(route) {
  const current = route === '/' ? '/' : `/${route.split('/').filter(Boolean)[0]}`;
  const items = [
    ['About', '/'],
    ['Thoughts', '/thoughts'],
    ['Projects', '/projects'],
  ];

  return items.map(([label, href]) => {
    const active = current === href ? ' active' : '';
    return `<li><a class="nav-link${active}" draggable="false" data-route="${href}" href="${relativeRoute(route, href)}">${label}</a></li>`;
  }).join('');
}

function shell({ route, title, site, article }) {
  const assets = relativeAssetPrefix(route);
  const fullTitle = title === site.name ? site.name : `${title} - ${site.name}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <meta name="theme-color" content="#fcfcfc">
  <meta name="color-scheme" content="only light">
  <meta name="description" content="${escapeHtml(site.description || '')}">
  <title>${escapeHtml(fullTitle)}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%23fcfcfc'/%3E%3Cpath d='M9 10h14v2H9zm0 5h14v2H9zm0 5h9v2H9z' fill='%233b4149'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="${assets}/styles.css">
  <script src="${assets}/client.js" defer></script>
</head>
<body data-route="${normalizeRoute(route)}">
  <div class="mobile-fade"></div>
  <div class="layout">
    <nav>
      <ul>${nav(normalizeRoute(route))}</ul>
    </nav>
    <main>
      <div class="divider"></div>
      <article>${article}</article>
    </main>
  </div>
</body>
</html>
`;
}

async function writePage(page, site) {
  const file = outputFile(page.route);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, shell({ ...page, site }));
}

async function build() {
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, 'assets'), { recursive: true });

  const site = await readJson(path.join(ROOT, 'site.config.json'), {
    name: 'Your Name',
    description: 'Personal blog',
  });

  const [about, projects, posts] = await Promise.all([
    loadPage(marked, path.join(CONTENT, 'about.md'), site.name),
    loadPage(marked, path.join(CONTENT, 'projects.md'), 'Projects'),
    loadPosts(marked),
  ]);

  await fs.copyFile(path.join(ROOT, 'src/styles.css'), path.join(DIST, 'assets/styles.css'));
  await fs.copyFile(path.join(ROOT, 'src/client.js'), path.join(DIST, 'assets/client.js'));
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');

  const pages = [
    { route: '/', title: about.title, article: about.article },
    { route: '/thoughts', title: 'Thoughts', article: thoughtsIndex(posts) },
    { route: '/projects', title: projects.title, article: projects.article },
    ...posts.map((post) => ({ route: post.route, title: post.title, article: post.article })),
  ];

  for (const page of pages) await writePage(page, site);

  await fs.writeFile(path.join(DIST, '404.html'), shell({
    route: '/',
    title: 'Not Found',
    site,
    article: '<h1>Not Found</h1>\n<p>The page you are looking for does not exist.</p>',
  }));

  console.log(`Built ${pages.length} pages to dist`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
