-- Samesun Hub v3: sections (Automations/Tools) + Models/Files folder system
-- Run this in the Supabase SQL editor. This REPLACES the old tools table structure.

-- Drop old table if migrating from v2 (skip if starting fresh)
drop table if exists tools cascade;

-- ── LINKS (Automations + Tools) ──────────────────────────────
create table links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  section text not null check (section in ('automations', 'tools')),
  name text not null,
  description text not null,
  live_url text,
  repo_url text,
  status text not null default 'live' check (status in ('live', 'degraded', 'down', 'beta')),
  owner text not null,
  created_at timestamptz default now()
);

alter table links enable row level security;

create policy "Authenticated users can view links" on links for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert links" on links for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update links" on links for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete links" on links for delete using (auth.role() = 'authenticated');

-- ── FOLDERS (used by both Models and Files sections) ────────
create table folders (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('models', 'files')),
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  created_at timestamptz default now()
);

alter table folders enable row level security;

create policy "Authenticated users can view folders" on folders for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert folders" on folders for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update folders" on folders for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete folders" on folders for delete using (auth.role() = 'authenticated');

-- ── DOCUMENTS (actual uploaded files, metadata) ──────────────
create table documents (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('models', 'files')),
  folder_id uuid references folders(id) on delete cascade,
  name text not null,
  storage_path text not null,
  size_bytes bigint,
  uploaded_by text,
  created_at timestamptz default now()
);

alter table documents enable row level security;

create policy "Authenticated users can view documents" on documents for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert documents" on documents for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update documents" on documents for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete documents" on documents for delete using (auth.role() = 'authenticated');

-- ── STORAGE BUCKET ────────────────────────────────────────────
-- Run this separately if the SQL editor doesn't support storage commands directly:
-- Go to Storage in the Supabase dashboard -> New bucket -> name it "hub-files" -> keep it Private

-- Storage policies (run after creating the bucket via dashboard):
-- These allow authenticated users to upload/download/delete within the hub-files bucket
insert into storage.buckets (id, name, public) values ('hub-files', 'hub-files', false)
  on conflict (id) do nothing;

create policy "Authenticated users can view files in hub-files"
  on storage.objects for select
  using (bucket_id = 'hub-files' and auth.role() = 'authenticated');

create policy "Authenticated users can upload to hub-files"
  on storage.objects for insert
  with check (bucket_id = 'hub-files' and auth.role() = 'authenticated');

create policy "Authenticated users can delete from hub-files"
  on storage.objects for delete
  using (bucket_id = 'hub-files' and auth.role() = 'authenticated');

-- ── SEED DATA ─────────────────────────────────────────────────
insert into links (slug, section, name, description, live_url, repo_url, status, owner) values
  ('mews-report', 'automations', 'Mews Revenue Report', 'Automated monthly executive performance reporting from MEWS export data', 'https://mewsrevreport.vercel.app', 'https://github.com/samesun-dev/mews-report', 'live', 'Owen'),
  ('samesun-tasks', 'tools', 'Samesun Tasks', 'Team task management with recurring resets and email notifications', 'https://samesun-tasks.vercel.app', 'https://github.com/samesun-dev/Samesun-Tasks', 'live', 'Owen');
