-- Samesun Hub v4: tag columns on documents for the Mews monthly import
-- pipeline (api/mews-import.js) + the "By Month" browsing view.
-- Run this in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

alter table documents add column if not exists city text;
alter table documents add column if not exists month text; -- sortable "YYYY-MM"
alter table documents add column if not exists report_type text;

create index if not exists documents_month_report_type_idx on documents (month, report_type);
