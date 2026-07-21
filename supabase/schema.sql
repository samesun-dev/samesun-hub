-- Samesun Hub v2: tools table schema with slug for routing
-- Run this in the Supabase SQL editor for your samesun-hub project

create table tools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  category text not null check (category in ('reporting', 'task_management', 'external', 'other')),
  live_url text,
  repo_url text,
  status text not null default 'live' check (status in ('live', 'degraded', 'down', 'beta')),
  owner text not null,
  last_checked timestamptz default now(),
  created_at timestamptz default now()
);

alter table tools enable row level security;

create policy "Authenticated users can view tools"
  on tools for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert tools"
  on tools for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update tools"
  on tools for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete tools"
  on tools for delete
  using (auth.role() = 'authenticated');

-- Seed data
insert into tools (slug, name, description, category, live_url, repo_url, status, owner) values
  ('mews-report', 'Mews Revenue Report', 'Automated monthly executive performance reporting from MEWS export data', 'reporting', 'https://mewsrevreport.vercel.app', 'https://github.com/samesun-dev/mews-report', 'live', 'Owen'),
  ('samesun-tasks', 'Samesun Tasks', 'Team task management with recurring resets and email notifications', 'task_management', 'https://samesun-tasks.vercel.app', 'https://github.com/samesun-dev/samesun-tasks', 'live', 'Owen'),
  ('dropbox', 'Dropbox', 'Shared company file storage', 'external', 'https://www.dropbox.com', null, 'live', 'IT');
