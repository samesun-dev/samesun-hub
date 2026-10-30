-- Samesun Hub v5: isolated `mews` schema for the Mews Reservation Report
-- ingest (api/mews-reservations.js) + voucher dashboard.
-- Run this in the Supabase SQL editor. Safe to re-run.
--
-- ISOLATION MODEL (shares the existing Supabase project, no extra cost):
--   * Own schema `mews`, never added to the API's "Exposed schemas", so the
--     browser client (anon key or logged-in user) cannot see it at all.
--   * Own login role `mews_app`; the Vercel functions connect as this role
--     (MEWS_DATABASE_URL), NOT with the project-wide service-role key. A
--     leak of that credential exposes this schema only.
--   * RLS on, with a policy for mews_app only; anon/authenticated have no
--     grants and no policies.
--   * NO personal data is ever stored: no names, emails, phones, addresses,
--     card details, notes, or birthdates. See ALLOWED_FIELDS in
--     api/_lib/mewsReservations.js.

create schema if not exists mews;

revoke all on schema mews from public;
revoke all on schema mews from anon, authenticated;

do $$
begin
  if not exists (select from pg_roles where rolname = 'mews_app') then
    create role mews_app login;
  end if;
end
$$;
-- AFTER running this file, set the password ONCE, directly in the SQL
-- editor (do not commit it anywhere):
--   alter role mews_app with password '<long random password>';

grant usage on schema mews to mews_app;

-- ── RESERVATIONS: one row per Mews reservation that carries a voucher ──
create table if not exists mews.reservations (
  property           text not null,            -- Parameters!B3, e.g. 'Samesun Banff'
  reservation_id     text not null,            -- Mews 'Identifier' (UUID)
  reservation_number text,                     -- Mews 'Number', e.g. BNF039711
  currency           text not null,            -- symbol read off the export, e.g. 'C$'
  status             text,
  created_at         timestamptz,              -- booking date
  arrival            timestamptz,
  departure          timestamptz,
  nights             integer,
  persons            integer,
  online             boolean not null default false, -- Origin = Mews Booking Engine
  voucher            text not null,
  revenue            numeric(12,2),            -- 'Total amount' (gross)
  rate               text,
  segment            text,
  source             text,                     -- 'Reservation source'
  space_category     text,
  nationality        text,
  first_seen_at      timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (property, reservation_id)
);

create index if not exists reservations_voucher_idx on mews.reservations (voucher);
create index if not exists reservations_created_idx on mews.reservations (property, created_at);
create index if not exists reservations_arrival_idx on mews.reservations (property, arrival);

-- ── IMPORTS: one row per received report (no payload, just metadata) ──
create table if not exists mews.imports (
  id              bigint generated always as identity primary key,
  received_at     timestamptz not null default now(),
  property        text not null,
  currency        text,
  report_filter   text,                        -- Parameters 'Filter' (e.g. Created)
  window_start    text,
  window_end      text,
  report_statuses text,
  rows_in_report  integer not null,
  rows_stored     integer not null
);

create index if not exists imports_property_idx on mews.imports (property, received_at desc);

alter table mews.reservations enable row level security;
alter table mews.imports enable row level security;

drop policy if exists "mews_app full access" on mews.reservations;
create policy "mews_app full access" on mews.reservations
  for all to mews_app using (true) with check (true);

drop policy if exists "mews_app full access" on mews.imports;
create policy "mews_app full access" on mews.imports
  for all to mews_app using (true) with check (true);

-- No delete: history is only ever upserted. No grants for anon/authenticated.
grant select, insert, update on mews.reservations to mews_app;
grant select, insert on mews.imports to mews_app;
grant usage, select on all sequences in schema mews to mews_app;
