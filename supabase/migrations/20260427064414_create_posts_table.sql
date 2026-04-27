create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  content text not null default '',
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.posts enable row level security;

create policy "service_role_full_access" on public.posts
  for all using (true) with check (true);

create index idx_posts_slug on public.posts (slug);
create index idx_posts_status on public.posts (status);
create index idx_posts_published_at on public.posts (published_at desc);

insert into storage.buckets (id, name, public) values ('images', 'images', true);

create policy "images_public_read" on storage.objects
  for select using (bucket_id = 'images');

create policy "images_service_role_insert" on storage.objects
  for insert with check (bucket_id = 'images');

create policy "images_service_role_delete" on storage.objects
  for delete using (bucket_id = 'images');
