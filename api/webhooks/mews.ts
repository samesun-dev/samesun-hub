// api/webhooks/mews.ts
//
// Vercel Serverless Function (NOT Next.js App Router — this repo is Vite).
// Place this file at: samesun-hub/api/webhooks/mews.ts
// Vercel auto-exposes it at: https://<your-domain>/api/webhooks/mews
//
// Receives POSTs from Mews "Webhook export target" configs.
// One export target per property x report type (18 total for Samesun), each pointed at:
//   https://<your-domain>/api/webhooks/mews?property=montreal&report=order-items&token=SECRET
//
// Folder structure produced on the Files page: Report type / Month / Property.xlsx

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // secret key — server-only, bypasses RLS
);

// --- Config: fill in your real property slugs / display names ---
const PROPERTIES: Record<string, string> = {
  montreal: "Samesun Montreal",
  toronto: "Samesun Toronto",
  vancouver: "Samesun Vancouver",
  banff: "Samesun Banff",
  guesthouse: "Guesthouse Vancouver",
  venicebeach: "Samesun Venice Beach",
  hollywood: "Samesun Hollywood",
  oceanbeach: "Samesun Ocean Beach",
  sanfrancisco: "Samesun San Francisco",
  // ...add any additional properties
};

const REPORTS: Record<string, string> = {
  "order-items": "Order Items",
  "manager-report": "Manager Report",
};

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

  const propertyKey = (req.query.property as string) ?? "";
  const reportKey = (req.query.report as string) ?? "";

  const propertyName = PROPERTIES[propertyKey];
  const reportName = REPORTS[reportKey];

  if (!propertyName || !reportName) {
    res.status(400).json({ error: "unknown property or report in query params" });
    return;
  }

  // req.body is already parsed JSON by Vercel when Content-Type is application/json
  const payload = req.body;

  // TEMPORARY — remove once we've confirmed the real Mews payload shape.
  // Logs the top-level keys and a truncated preview so we can see the
  // actual structure in Vercel's function logs without dumping the
  // entire (possibly large) payload.
  console.log(
    "MEWS PAYLOAD DEBUG — top-level keys:",
    payload && typeof payload === "object" ? Object.keys(payload) : typeof payload
  );
  console.log(
    "MEWS PAYLOAD DEBUG — preview:",
    JSON.stringify(payload).slice(0, 2000)
  );

  // IMPORTANT: Mews has flagged some accounts' exports as "failed" even after
  // a 200 response (see Mews Community reports from June 2026). We therefore
  // always ACK 200 once the payload is received, and log any processing
  // errors separately rather than surfacing them to Mews as a failed export.
  try {
    await processReport({ propertyName, reportName, payload });
  } catch (err) {
    console.error("Mews webhook processing error:", err);
    await supabase.from("webhook_errors").insert({
      property: propertyName,
      report: reportName,
      error_message: err instanceof Error ? err.message : String(err),
      raw_payload: payload,
    });
  }

  res.status(200).json({ ok: true });
}

async function processReport({
  propertyName,
  reportName,
  payload,
}: {
  propertyName: string;
  reportName: string;
  payload: unknown;
}) {
  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" }); // "August 2026"
  const monthSort = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // "2026-08"

  // --- Normalize the Mews payload into rows for the spreadsheet ---
  // NOTE: adjust this to match the actual shape of Mews's webhook JSON —
  // trigger a real test export first and log `payload` (check Vercel's
  // function logs) before trusting this conversion.
  const rows = Array.isArray(payload)
    ? payload
    : (payload as any)?.data ?? (payload as any)?.rows ?? [payload];

  const worksheet = XLSX.utils.json_to_sheet(rows as Record<string, unknown>[]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, reportName.slice(0, 31)); // sheet name max 31 chars
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
      updated_at: now.toISOString(),
    },
    { onConflict: "path" }
  );

  if (dbError) throw dbError;

}