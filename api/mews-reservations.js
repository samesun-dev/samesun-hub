// api/mews-reservations.js
//
// Vercel Serverless Function (Vite project — not Next.js).
//
// Receives a Mews *Reservation Report* (scheduled export -> webhook,
// Format: Excel, raw .xlsx bytes as the body — same delivery shape as
// api/mews-import.js) and stores the voucher-bearing, PII-free rows in the
// isolated `mews` schema.
//
//   curl -X POST "https://<domain>/api/mews-reservations?token=SECRET" \
//     --data-binary @report.xlsx \
//     -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//
// The property is read from the file itself (Parameters!B3), so the SAME url
// works for every property. Env: MEWS_RESERVATIONS_SECRET, MEWS_DATABASE_URL
// (connection string for the scoped `mews_app` role — NOT the service-role key).
//
// PRIVACY: the raw file only ever exists in memory for this request. It is
// never written to storage, and — unlike api/webhooks/mews.ts — a failure
// never persists the payload. Errors log message text only.

import { timingSafeEqual } from "crypto";
import Busboy from "@fastify/busboy";
import pg from "pg";
import { parseReservationReport } from "./_lib/mewsReservations.js";
import { storeReport } from "./_lib/mewsStore.js";

// Small pool: serverless instances are short-lived. Use the Supabase
// *transaction pooler* connection string (port 6543) for MEWS_DATABASE_URL.
let pool;
function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.MEWS_DATABASE_URL,
      max: 1,
      // Supabase's pooler presents a cert Node doesn't trust by default.
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

function tokenOk(provided) {
  const expected = process.env.MEWS_RESERVATIONS_SECRET;
  if (!expected || typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function readMultipartFile(req) {
  return new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: req.headers });
    let buf = null;
    busboy.on("file", (_f, stream) => {
      const chunks = [];
      stream.on("data", (c) => chunks.push(c));
      stream.on("end", () => (buf = Buffer.concat(chunks)));
    });
    busboy.on("finish", () => (buf ? resolve(buf) : reject(new Error("No file in multipart body"))));
    busboy.on("error", reject);
    req.pipe(busboy);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }
  if (!tokenOk(req.query.token)) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const contentType = req.headers["content-type"] || "";
    const buffer = contentType.includes("multipart/form-data")
      ? await readMultipartFile(req)
      : await readRawBody(req);
    if (!buffer.length) throw new Error("Empty request body");

    const report = parseReservationReport(buffer);
    const stored = await storeReport(getPool(), report);

    res.status(200).json({
      success: true,
      property: report.property,
      reservations_in_report: report.reservationsInReport,
      voucher_rows_stored: stored,
    });
  } catch (err) {
    // Message only — never the payload or parsed rows.
    console.error("mews-reservations error:", err instanceof Error ? err.message : String(err));
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}
