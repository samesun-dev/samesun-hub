# Samesun Hub v3

Notion-structure + Squarespace-polish internal workspace. Four sections:
Automations, Tools (link directories), Models, Files (folder-based file storage).

## Setup

1. Create Supabase project (or reuse existing hub project)
2. Run supabase/schema_v3.sql in the SQL editor — this creates links/folders/documents
   tables AND the storage bucket + policies in one go
3. If the storage bucket insert fails in SQL editor, create it manually:
   Storage -> New bucket -> name "hub-files" -> Private, then re-run just the
   three storage policy CREATE POLICY statements from the schema file
4. Add auth users: Authentication -> Users -> Add user
5. cp .env.local.example .env.local, fill in your Supabase URL + anon key
6. npm install && npm run dev

## Structure

- Overview (/) — main landing page, not yet redesigned, still simple list
- Automations (/automations) — link directory, same pattern as old Tools page
- Tools (/tools) — link directory
- Models (/models) — folder browser for blank templates (upload .xlsx etc, organize into folders)
- Files (/files) — folder browser for shared documents

Models and Files share the same FileBrowser component/logic, just scoped to
different `section` values so they never mix content.

## Adding content

- Automations/Tools: click "Add" button on that section's page — no SQL needed
- Models/Files: click "New folder" or "Upload" directly in the browser — no SQL needed

## Not built yet

- Overview page still needs the photo/Notion-links redesign (intentionally deferred)
- No automated MEWS webhook import yet (separate project, needs its own scoping)
- No admin role distinction — currently any authenticated user can add/delete
