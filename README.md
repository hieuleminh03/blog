# Static Blog

Markdown-driven static blog with a shud.in-style layout, ready for GitHub Pages.

## Edit Site Info

Edit `site.config.json`:

```json
{
  "name": "Your Name",
  "description": "Personal blog"
}
```

## Edit Pages

- Home/about page: `content/about.md`
- Projects page: `content/projects.md`
- Blog posts: `content/posts/*.md`

## Add A Post

```bash
npm run new:post -- "My New Post"
```

Then edit the generated Markdown file in `content/posts/`.

Post frontmatter:

```markdown
---
title: My New Post
date: 2026-04-26
description: Optional description
draft: false
---
```

Set `draft: true` to hide a post from the build.

## Build

```bash
npm run build
```

The static site is written to `dist/`.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds `dist/` and deploys it through GitHub Pages. In the repository settings, set Pages to use GitHub Actions.
