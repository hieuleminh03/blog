import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-auth-token",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}

function html(content: string) {
  return new Response(content, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
  })
}

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "post"
}

function verifyToken(req: Request): boolean {
  const token = req.headers.get("x-auth-token")
  return token === Deno.env.get("ADMIN_PASSWORD")
}

async function commitToGitHub(path: string, content: string, message: string) {
  const token = Deno.env.get("GITHUB_TOKEN")!
  const repo = Deno.env.get("GITHUB_REPO")!
  const url = `https://api.github.com/repos/${repo}/contents/${path}`

  const existing = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  })

  let sha: string | undefined
  if (existing.ok) {
    const data = await existing.json()
    sha = data.sha
  }

  const body: Record<string, unknown> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
  }
  if (sha) body.sha = sha

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub commit failed: ${err}`)
  }
  return res.json()
}

async function deleteFromGitHub(path: string, message: string) {
  const token = Deno.env.get("GITHUB_TOKEN")!
  const repo = Deno.env.get("GITHUB_REPO")!
  const url = `https://api.github.com/repos/${repo}/contents/${path}`

  const existing = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  })
  if (!existing.ok) return

  const data = await existing.json()
  await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, sha: data.sha }),
  })
}

function buildMarkdown(post: { title: string; date: string; description: string; content: string }) {
  const lines = ["---"]
  lines.push(`title: '${post.title.replace(/'/g, "''")}'`)
  if (post.date) lines.push(`date: '${post.date}'`)
  if (post.description) lines.push(`description: '${post.description.replace(/'/g, "''")}'`)
  lines.push("---")
  lines.push("")
  lines.push(post.content)
  return lines.join("\n")
}

const ADMIN_UI = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blog Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;min-height:100vh}
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-box{background:#161616;padding:2rem;border-radius:8px;width:320px}
.login-box h1{font-size:1.2rem;margin-bottom:1rem;color:#fff}
input,textarea,select{width:100%;padding:.6rem;background:#1e1e1e;border:1px solid #333;border-radius:4px;color:#e0e0e0;font-size:.9rem;font-family:inherit}
input:focus,textarea:focus{outline:none;border-color:#555}
textarea{min-height:300px;resize:vertical;font-family:ui-monospace,monospace;font-size:.85rem;line-height:1.5}
button{padding:.5rem 1rem;border:none;border-radius:4px;cursor:pointer;font-size:.85rem;font-weight:500;transition:opacity .15s}
button:hover{opacity:.85}
.btn-primary{background:#3b82f6;color:#fff}
.btn-danger{background:#ef4444;color:#fff}
.btn-secondary{background:#333;color:#e0e0e0}
.btn-success{background:#22c55e;color:#fff}
.btn-sm{padding:.35rem .7rem;font-size:.8rem}
.app{max-width:900px;margin:0 auto;padding:1.5rem}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem}
.header h1{font-size:1.3rem;color:#fff}
.row{display:flex;gap:.5rem;align-items:center;margin-bottom:1rem}
.list{list-style:none}
.list li{padding:.75rem 1rem;background:#161616;border-radius:4px;margin-bottom:.5rem;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:background .15s}
.list li:hover{background:#1e1e1e}
.list li.active{background:#1e3a5f;border-left:3px solid #3b82f6}
.list .title{flex:1;font-weight:500}
.list .badge{font-size:.7rem;padding:.15rem .5rem;border-radius:99px;margin-left:.5rem}
.badge-draft{background:#333;color:#aaa}
.badge-published{background:#1a3a2a;color:#4ade80}
.editor{margin-top:1rem}
.field{margin-bottom:1rem}
.field label{display:block;font-size:.8rem;color:#888;margin-bottom:.3rem;text-transform:uppercase;letter-spacing:.5px}
.preview{background:#161616;padding:1rem;border-radius:4px;margin-top:1rem;max-height:200px;overflow:auto;font-size:.85rem;line-height:1.6}
.preview img{max-width:100%;border-radius:4px}
.toast{position:fixed;bottom:1.5rem;right:1.5rem;padding:.7rem 1.2rem;border-radius:4px;font-size:.85rem;z-index:999;animation:fadein .2s}
.toast-ok{background:#1a3a2a;color:#4ade80}
.toast-err{background:#3a1a1a;color:#f87171}
@keyframes fadein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.upload-zone{border:2px dashed #333;border-radius:4px;padding:1.5rem;text-align:center;color:#666;font-size:.85rem;cursor:pointer;transition:border-color .15s}
.upload-zone:hover{border-color:#555}
.upload-zone.dragover{border-color:#3b82f6;color:#3b82f6}
.img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:.5rem;margin-top:.5rem}
.img-grid img{width:100%;border-radius:4px;aspect-ratio:1;object-fit:cover;cursor:pointer}
.img-grid img:hover{opacity:.8}
.hidden{display:none}
.flex-between{display:flex;justify-content:space-between;align-items:center}
</style>
</head>
<body>
<div id="app">
  <div class="login-wrap" id="loginView">
    <div class="login-box">
      <h1>Blog Admin</h1>
      <div class="field">
        <label>Password</label>
        <input type="password" id="passInput" placeholder="Enter admin password">
      </div>
      <button class="btn-primary" style="width:100%" onclick="doLogin()">Login</button>
      <p id="loginErr" style="color:#f87171;font-size:.8rem;margin-top:.5rem"></p>
    </div>
  </div>

  <div class="app hidden" id="mainView">
    <div class="header">
      <h1>Posts</h1>
      <div class="row">
        <button class="btn-primary" onclick="newPost()">+ New Post</button>
        <button class="btn-secondary btn-sm" onclick="doLogout()">Logout</button>
      </div>
    </div>

    <ul class="list" id="postList"></ul>

    <div class="editor hidden" id="editor">
      <hr style="border:none;border-top:1px solid #222;margin:1.5rem 0">
      <div class="flex-between" style="margin-bottom:1rem">
        <h2 id="editorTitle" style="font-size:1.1rem;color:#fff">New Post</h2>
        <div class="row">
          <button class="btn-success btn-sm" onclick="savePost('published')">Publish</button>
          <button class="btn-secondary btn-sm" onclick="savePost('draft')">Save Draft</button>
          <button class="btn-danger btn-sm" onclick="deletePost()">Delete</button>
          <button class="btn-secondary btn-sm" onclick="closeEditor()">Close</button>
        </div>
      </div>
      <div class="field">
        <label>Title</label>
        <input type="text" id="postTitle" placeholder="Post title">
      </div>
      <div class="field">
        <label>Slug</label>
        <input type="text" id="postSlug" placeholder="auto-generated from title">
      </div>
      <div class="field">
        <label>Date</label>
        <input type="date" id="postDate">
      </div>
      <div class="field">
        <label>Description</label>
        <input type="text" id="postDesc" placeholder="Short description">
      </div>
      <div class="field">
        <label>Content (Markdown)</label>
        <textarea id="postContent" placeholder="Write your post in markdown..."></textarea>
      </div>
      <div class="field">
        <label>Images</label>
        <div class="upload-zone" id="uploadZone">
          Drop images here or click to upload
          <input type="file" id="fileInput" accept="image/*" multiple style="display:none">
        </div>
        <div class="img-grid" id="imgGrid"></div>
      </div>
    </div>
  </div>
</div>

<script>
let TOKEN = localStorage.getItem('admin_token');
let posts = [];
let editingId = null;

const API = location.origin + '/functions/v1/admin';

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': TOKEN, ...opts.headers },
  });
  if (res.status === 401) { doLogout(); throw new Error('Unauthorized'); }
  return res.json();
}

function toast(msg, ok = true) {
  const el = document.createElement('div');
  el.className = 'toast ' + (ok ? 'toast-ok' : 'toast-err');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function doLogin() {
  TOKEN = document.getElementById('passInput').value;
  api('/posts').then(data => {
    localStorage.setItem('admin_token', TOKEN);
    posts = data.posts || [];
    showMain();
  }).catch(() => {
    document.getElementById('loginErr').textContent = 'Invalid password';
  });
}

function doLogout() {
  TOKEN = null;
  localStorage.removeItem('admin_token');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('mainView').classList.add('hidden');
}

function showMain() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('mainView').classList.remove('hidden');
  renderList();
}

function renderList() {
  const ul = document.getElementById('postList');
  if (!posts.length) { ul.innerHTML = '<li style="color:#666;cursor:default">No posts yet</li>'; return; }
  ul.innerHTML = posts.map(p => {
    const badge = p.status === 'published' ? 'badge-published' : 'badge-draft';
    const date = p.published_at ? new Date(p.published_at).toLocaleDateString() : (p.created_at ? new Date(p.created_at).toLocaleDateString() : '');
    return '<li onclick="editPost(\\'' + p.id + '\\')" class="' + (editingId === p.id ? 'active' : '') + '">' +
      '<span class="title">' + esc(p.title) + '</span>' +
      '<span style="color:#666;font-size:.8rem">' + date + '</span>' +
      '<span class="badge ' + badge + '">' + p.status + '</span></li>';
  }).join('');
}

function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

function newPost() {
  editingId = null;
  document.getElementById('editorTitle').textContent = 'New Post';
  document.getElementById('postTitle').value = '';
  document.getElementById('postSlug').value = '';
  document.getElementById('postDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('postDesc').value = '';
  document.getElementById('postContent').value = '';
  document.getElementById('imgGrid').innerHTML = '';
  document.getElementById('editor').classList.remove('hidden');
  loadImages();
}

function editPost(id) {
  const post = posts.find(p => p.id === id);
  if (!post) return;
  editingId = id;
  document.getElementById('editorTitle').textContent = 'Edit Post';
  document.getElementById('postTitle').value = post.title;
  document.getElementById('postSlug').value = post.slug;
  document.getElementById('postDate').value = post.published_at ? post.published_at.slice(0, 10) : '';
  document.getElementById('postDesc').value = post.description || '';
  document.getElementById('postContent').value = post.content || '';
  document.getElementById('editor').classList.remove('hidden');
  loadImages();
}

function closeEditor() {
  editingId = null;
  document.getElementById('editor').classList.add('hidden');
  renderList();
}

async function savePost(status) {
  const title = document.getElementById('postTitle').value.trim();
  if (!title) { toast('Title required', false); return; }
  const slug = document.getElementById('postSlug').value.trim() || slugify(title);
  const body = {
    title,
    slug,
    date: document.getElementById('postDate').value,
    description: document.getElementById('postDesc').value.trim(),
    content: document.getElementById('postContent').value,
    status,
  };
  try {
    const data = editingId
      ? await api('/posts/' + editingId, { method: 'PUT', body: JSON.stringify(body) })
      : await api('/posts', { method: 'POST', body: JSON.stringify(body) });
    if (data.error) { toast(data.error, false); return; }
    toast(status === 'published' ? 'Published!' : 'Draft saved');
    await loadPosts();
    if (data.post) editingId = data.post.id;
    renderList();
  } catch (e) { toast(e.message, false); }
}

async function deletePost() {
  if (!editingId) return;
  if (!confirm('Delete this post?')) return;
  try {
    await api('/posts/' + editingId, { method: 'DELETE' });
    toast('Deleted');
    editingId = null;
    document.getElementById('editor').classList.add('hidden');
    await loadPosts();
    renderList();
  } catch (e) { toast(e.message, false); }
}

async function loadPosts() {
  const data = await api('/posts');
  posts = data.posts || [];
}

async function loadImages() {
  const data = await api('/images');
  const grid = document.getElementById('imgGrid');
  grid.innerHTML = (data.images || []).map(img =>
    '<img src="' + img.url + '" onclick="insertImage(\\'' + img.url + '\\')" title="Click to insert">'
  ).join('');
}

function insertImage(url) {
  const ta = document.getElementById('postContent');
  const md = '![](' + url + ')';
  const start = ta.selectionStart;
  ta.value = ta.value.slice(0, start) + md + ta.value.slice(ta.selectionEnd);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + md.length;
}

function slugify(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'post';
}

// Auto-generate slug from title
document.getElementById('postTitle').addEventListener('input', function() {
  if (!editingId) document.getElementById('postSlug').value = slugify(this.value);
});

// File upload
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  uploadFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => uploadFiles(fileInput.files));

async function uploadFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(API + '/upload', {
        method: 'POST',
        headers: { 'X-Auth-Token': TOKEN },
        body: form,
      });
      const data = await res.json();
      if (data.url) {
        toast('Uploaded: ' + file.name);
        loadImages();
      } else {
        toast(data.error || 'Upload failed', false);
      }
    } catch (e) { toast(e.message, false); }
  }
}

// Init
if (TOKEN) {
  api('/posts').then(data => {
    posts = data.posts || [];
    showMain();
  }).catch(() => { TOKEN = null; localStorage.removeItem('admin_token'); });
}

document.getElementById('passInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
</script>
</body>
</html>`

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(req.url)
  // supabase passes path as /admin, strip it
  let path = url.pathname.replace(/^\/admin/, "") || "/"

  // GET root - serve UI
  if (req.method === "GET" && path === "/") {
    return html(ADMIN_UI)
  }

  // All other routes require auth
  if (!verifyToken(req)) {
    return json({ error: "Unauthorized" }, 401)
  }

  const supabase = createClient(
    Deno.env.get("SB_URL")!,
    Deno.env.get("SB_SERVICE_KEY")!,
  )

  try {
    // GET /posts - list all posts
    if (req.method === "GET" && path === "/posts") {
      const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false })
      if (error) throw error
      return json({ posts: data })
    }

    // POST /posts - create post
    if (req.method === "POST" && path === "/posts") {
      const body = await req.json()
      const slug = body.slug || slugify(body.title)
      const { data, error } = await supabase.from("posts").insert({
        title: body.title,
        slug,
        content: body.content || "",
        description: body.description || "",
        status: body.status || "draft",
        published_at: body.status === "published" ? new Date().toISOString() : null,
      }).select().single()
      if (error) throw error

      if (body.status === "published") {
        const md = buildMarkdown({ title: body.title, date: body.date || new Date().toISOString().slice(0, 10), description: body.description || "", content: body.content || "" })
        await commitToGitHub(`content/posts/${slug}.md`, md, `publish: ${body.title}`)
      }

      return json({ post: data })
    }

    // PUT /posts/:id - update post
    const putMatch = path.match(/^\/posts\/(.+)$/)
    if (req.method === "PUT" && putMatch) {
      const body = await req.json()
      const update: Record<string, unknown> = {
        title: body.title,
        slug: body.slug,
        content: body.content,
        description: body.description,
        status: body.status,
        updated_at: new Date().toISOString(),
      }
      if (body.status === "published") update.published_at = new Date().toISOString()

      const { data, error } = await supabase.from("posts").update(update).eq("id", putMatch[1]).select().single()
      if (error) throw error

      if (body.status === "published") {
        const md = buildMarkdown({ title: body.title, date: body.date || new Date().toISOString().slice(0, 10), description: body.description || "", content: body.content || "" })
        await commitToGitHub(`content/posts/${body.slug}.md`, md, `update: ${body.title}`)
      } else {
        // If set to draft, remove from GitHub
        await deleteFromGitHub(`content/posts/${body.slug}.md`, `unpublish: ${body.title}`)
      }

      return json({ post: data })
    }

    // DELETE /posts/:id
    if (req.method === "DELETE" && putMatch) {
      const { data: post } = await supabase.from("posts").select("slug").eq("id", putMatch[1]).single()
      const { error } = await supabase.from("posts").delete().eq("id", putMatch[1])
      if (error) throw error
      if (post) await deleteFromGitHub(`content/posts/${post.slug}.md`, `delete: ${post.slug}`)
      return json({ ok: true })
    }

    // POST /upload - upload image
    if (req.method === "POST" && path === "/upload") {
      const form = await req.formData()
      const file = form.get("file") as File
      if (!file) return json({ error: "No file" }, 400)

      const ext = file.name.split(".").pop() || "png"
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const buffer = new Uint8Array(await file.arrayBuffer())

      const { error } = await supabase.storage.from("images").upload(name, buffer, {
        contentType: file.type,
        upsert: false,
      })
      if (error) throw error

      const { data: urlData } = supabase.storage.from("images").getPublicUrl(name)
      return json({ url: urlData.publicUrl, name })
    }

    // GET /images - list images
    if (req.method === "GET" && path === "/images") {
      const { data, error } = await supabase.storage.from("images").list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } })
      if (error) throw error
      const images = (data || []).map(f => {
        const { data: urlData } = supabase.storage.from("images").getPublicUrl(f.name)
        return { name: f.name, url: urlData.publicUrl }
      })
      return json({ images })
    }

    return json({ error: "Not found" }, 404)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
