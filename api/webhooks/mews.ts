// api/webhooks/mews.ts
//
// Vercel Serverless Function (Vite project — not Next.js).
// Place at: samesun-hub/api/webhooks/mews.ts
//
// Receives POSTs from Mews "Webhook export target" configs (Format: JSON).
// Auto-detects property, month, and report type from the payload itself —
// no query params needed beyond ?token=SECRET, so the SAME url works for
// every property and every report type:
//
//   https://<your-domain>/api/webhooks/mews?token=SECRET
//
// IMPORTANT: this writes into the SAME tables/bucket the existing Files
// page (FileBrowser.jsx) already reads from — `folders`, `documents`,
// and the `hub-files` storage bucket — with section = "files". No new
// Supabase schema or bucket needed; nothing from the earlier
// mews-reports/files-table approach is used anymore.
//
// Resulting structure on the Files page: Report type (folder) >
// Month (subfolder) > Property.xlsx (document)

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // secret key — server-only, bypasses RLS
);

const SECTION = "files"; // matches FileBrowser's `section` prop for the Files page

// Keyword patterns matched against the report title (e.g. "Order items
// report consumed 2026-07-01...") to determine the report-type folder name.
const REPORT_KEYWORDS: [RegExp, string][] = [
  [/order items?/i, "Order Items"],
  [/manager/i, "Manager Report"],
];

interface MewsDocument {
  Name: string; // e.g. "Parameters", "Items", "Outlets", "Tax summary"
  Data: unknown[][];
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Finds an existing folder by (section, slug, parent) or creates it —
// same slug algorithm FileBrowser.jsx already uses, so breadcrumb
// navigation matches correctly.
async function getOrCreateFolder({
  name,
  parentId,
}: {
  name: string;
  parentId: string | null;
}) {
  const slug = slugify(name);
  const query = supabase.from("folders").select("*").eq("section", SECTION).eq("slug", slug);
  const { data: existing } = parentId
    ? await query.eq("parent_id", parentId).maybeSingle()
    : await query.is("parent_id", null).maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("folders")
    .insert({ section: SECTION, name, slug, parent_id: parentId })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const token = req.query.token as string | undefined;
  if (token !== process.env.MEWS_WEBHOOK_SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const manualReportOverride = req.query.report as string | undefined;
  const payload = req.body as { Documents?: MewsDocument[] } | undefined;

  // Mews has flagged some accounts' exports as "failed" even after a 200
  // response, so we always ACK 200 once received, and log processing
  // errors separately rather than surfacing them to Mews as a failure.
  try {
    await processReport({ payload, manualReportOverride });
  } catch (err) {
    console.error("Mews webhook processing error:", err);
    await supabase.from("webhook_errors").insert({
      error_message: err instanceof Error ? err.message : String(err),
      raw_payload: payload,
    });
  }

  res.status(200).json({ ok: true });
}

async function processReport({
  payload,
  manualReportOverride,
}: {
  payload: { Documents?: MewsDocument[] } | undefined;
  manualReportOverride?: string;
}) {
  const documents = payload?.Documents;
  if (!documents || !Array.isArray(documents) || documents.length === 0) {
    throw new Error("Payload missing Documents array — unexpected shape");
  }

  const paramsDoc = documents.find((d) => d.Name === "Parameters");
  if (!paramsDoc) {
    throw new Error("Payload missing 'Parameters' document — can't auto-detect property/month");
  }

  const title = String(paramsDoc.Data[0]?.[0] ?? "");
  const paramRows = paramsDoc.Data.slice(1) as [string, string][];
  const params: Record<string, string> = Object.fromEntries(
    paramRows.map(([key, value]) => [key, value == null ? "" : String(value)])
  );

  const propertyName = params["Enterprise"];
  if (!propertyName) {
    throw new Error("Parameters section missing 'Enterprise' — can't determine property");
  }

  let reportName = manualReportOverride;
  if (!reportName) {
    const match = REPORT_KEYWORDS.find(([pattern]) => pattern.test(title));
    reportName = match ? match[1] : "Uncategorized Report";
  }

  const startDateStr = params["Start"];
  const periodDate = startDateStr ? new Date(startDateStr) : new Date();
  const monthLabel = periodDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  // --- Build a multi-sheet workbook — one sheet per Mews "Document" ---
  const workbook = XLSX.utils.book_new();
  for (const doc of documents) {
    const sheetName = doc.Name.slice(0, 31);
    const worksheet = XLSX.utils.aoa_to_sheet(doc.Data as unknown[][]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  // --- Get/create the Report type folder, then the Month subfolder inside it ---
  const reportFolder = await getOrCreateFolder({ name: reportName, parentId: null });
  const monthFolder = await getOrCreateFolder({ name: monthLabel, parentId: reportFolder.id });

  const fileName = `${propertyName}.xlsx`;

  // --- Overwrite behavior: if this property/report/month already has a
  // document (e.g. re-running the same month), remove the old one first,
  // matching the "upsert" behavior we want for monthly re-runs. ---
  const { data: existingDoc } = await supabase
    .from("documents")
    .select("*")
    .eq("section", SECTION)
    .eq("folder_id", monthFolder.id)
    .eq("name", fileName)
    .maybeSingle();

  if (existingDoc) {
    await supabase.storage.from("hub-files").remove([existingDoc.storage_path]);
    await supabase.from("documents").delete().eq("id", existingDoc.id);
  }

  const storagePath = `${SECTION}/${randomUUID()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("hub-files")
    .upload(storagePath, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase.from("documents").insert({
    section: SECTION,
    folder_id: monthFolder.id,
    name: fileName,
    storage_path: storagePath,
    size_bytes: buffer.length,
  });

  if (dbError) throw dbError;
}