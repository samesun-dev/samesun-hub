// api/webhooks/mews.ts
//
// Vercel Serverless Function (Vite project — not Next.js).
// Place at: samesun-hub/api/webhooks/mews.ts
// Vercel auto-exposes it at: https://<your-domain>/api/webhooks/mews
//
// Receives POSTs from Mews "Webhook export target" configs.
//
// AUTO-DETECTION: property and month/year are read directly out of the
// Mews payload's "Parameters" section — no need to encode them in the URL.
// Report type is auto-detected from the report title text, with an
// optional ?report= query param as a manual override/fallback.
//
// Minimal URL needed per export target:
//   https://<your-domain>/api/webhooks/mews?token=SECRET
// (You can still add &report=order-items if you want to force it rather
// than rely on title-text detection — see REPORT_KEYWORDS below.)
//
// Folder structure produced on the Files page: Report type / Month / Property.xlsx

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // secret key — server-only, bypasses RLS
);

// Keyword patterns matched against the report title (e.g. "Order items
// report consumed 2026-07-01...") to determine the report type folder name.
// Add more patterns here as you wire up additional report types.
const REPORT_KEYWORDS: [RegExp, string][] = [
  [/order items?/i, "Order Items"],
  [/manager/i, "Manager Report"],
];

interface MewsDocument {
  Name: string; // e.g. "Parameters", "Items", "Outlets", "Tax summary"
  Data: unknown[][]; // array of rows, each row is an array of cell values
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // TEMPORARY DIAGNOSTIC — confirms whether Vercel is invoking this handler
  // at all, and shows the real request headers (not visible in the Vercel
  // dashboard's log detail panel). Remove once the 400 issue is resolved.
  console.log("HANDLER INVOKED — method:", req.method);
  console.log("HANDLER INVOKED — headers:", JSON.stringify(req.headers));
  console.log(
    "HANDLER INVOKED — body type:",
    typeof req.body,
    "isArray:",
    Array.isArray(req.body)
  );

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

  // IMPORTANT: Mews has flagged some accounts' exports as "failed" even after
  // a 200 response (see Mews Community reports, June 2026). We always ACK 200
  // once the payload is received, and log processing errors separately.
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

  // Parameters.Data[0] is a single-cell title row, e.g.
  // ["Order items report consumed 2026-07-01 12:00:00 a.m. - 2026-08-01 12:00:00 a.m."]
  // Every row after that is a [key, value] pair, e.g. ["Enterprise","Samesun Toronto"]
  const title = String(paramsDoc.Data[0]?.[0] ?? "");
  const paramRows = paramsDoc.Data.slice(1) as [string, string][];
  const params: Record<string, string> = Object.fromEntries(
    paramRows.map(([key, value]) => [key, value == null ? "" : String(value)])
  );

  const propertyName = params["Enterprise"];
  if (!propertyName) {
    throw new Error("Parameters section missing 'Enterprise' — can't determine property");
  }

  // --- Report type: auto-detect from title text, or use manual override ---
  let reportName = manualReportOverride;
  if (!reportName) {
    const match = REPORT_KEYWORDS.find(([pattern]) => pattern.test(title));
    reportName = match ? match[1] : "Uncategorized Report";
  }

  // --- Month: use the period the report actually COVERS (Start date), not
  // today's date — e.g. an export run in early August covering July data
  // should file under "July 2026", matching how you'd expect it organized. ---
  const startDateStr = params["Start"]; // e.g. "2026-07-01T00:00:00"
  const periodDate = startDateStr ? new Date(startDateStr) : new Date();
  const monthLabel = periodDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const monthSort = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;

  // --- Build a multi-sheet workbook — one sheet per Mews "Document" ---
  const workbook = XLSX.utils.book_new();
  for (const doc of documents) {
    const sheetName = doc.Name.slice(0, 31); // Excel sheet name limit
    const worksheet = XLSX.utils.aoa_to_sheet(doc.Data as unknown[][]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const fileName = `${propertyName.replace(/\s+/g, "-")}.xlsx`;
  const folderPath = `${reportName}/${monthLabel}`;
  const storagePath = `mews-reports/${folderPath}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("mews-reports")
    .upload(storagePath, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true, // overwrite if this property's report for this month already ran
    });

  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase.from("files").upsert(
    {
      path: storagePath,
      name: fileName,
      report_type: reportName,
      month_label: monthLabel,
      month_sort: monthSort,
      property: propertyName,
      source: "mews_webhook",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "path" }
  );

  if (dbError) throw dbError;
}