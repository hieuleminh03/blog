const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const POSTS = path.join(ROOT, 'content', 'posts');

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'post';
}

function localDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

async function main() {
  const title = process.argv.slice(2).join(' ').trim();
  if (!title) {
    console.error('Usage: npm run new:post -- "Post Title"');
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(POSTS, { recursive: true });
  const slug = slugify(title);
  const file = path.join(POSTS, `${slug}.md`);

  try {
    await fs.access(file);
    throw new Error(`Post already exists: ${path.relative(ROOT, file)}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const body = `---
title: ${title}
date: ${localDate()}
description:
draft: false
---

Start writing here.
`;

  await fs.writeFile(file, body);
  console.log(`Created ${path.relative(ROOT, file)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
