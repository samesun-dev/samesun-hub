// api/mews-import.js
//
// Vercel Serverless Function (Vite project — not Next.js).
//
// Receives a monthly Mews report export as a raw file upload (not the
// JSON webhook shape used by api/webhooks/mews.ts) and files it into the
// same tables/bucket the Files page (FileBrowser.jsx) already reads from —
// `folders`, `documents`, and the `hub-files` storage bucket, section
// "files" — plus three tag columns (city, month, report_type) that power
// the "By Month" browsing view.
//
//   curl -X POST "https://<domain>/api/mews-import?report=orderitems&token=SECRET" \
//     -F "file=@/path/to/export.xlsx"
//
// ?report= is one of: orderitems | manager | ledger

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import Busboy from "@fastify/busboy";
import * as XLSX from "xlsx";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // secret key — server-only, bypasses RLS
);

const SECTION = "files"; // matches FileBrowser's `section` prop for the Files page
const IMPORTS_FOLDER_NAME = "Mews Imports";

const REPORT_TYPES = {
  orderitems: "Order Items",
  manager: "Manager Report",
  ledger: "Ledger Report",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Finds an existing folder by (section, slug, parent) or creates it — same
// slug algorithm FileBrowser.jsx uses, so breadcrumb navigation still works.
async function getOrCreateFolder({ name, parentId }) {
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

// Reports run on a fixed monthly schedule and are uploaded after the month
// they cover has closed (e.g. an early-July upload covers June), so "the
// current month" for tagging purposes is the calendar month before now.
function getPreviousMonth(now = new Date()) {
  let year = now.getFullYear();
  let monthIndex = now.getMonth() - 1; // 0-indexed
  if (monthIndex < 0) {
    monthIndex = 11;
    year -= 1;
  }
  return {
    monthName: MONTH_NAMES[monthIndex],
    year,
    sortable: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
  };
}

function parseMultipartFile(req) {
  return new Promise((resolve, reject) => {
    const busboy = new Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileFound = false;

    busboy.on("file", (_fieldname, stream) => {
      fileFound = true;
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on("finish", () => {
      if (!fileFound || !fileBuffer) {
        reject(new Error("No file found in multipart/form-data body"));
        return;
      }
      resolve(fileBuffer);
    });

    busboy.on("error", reject);

    req.pipe(busboy);
  });
}

// Mews's webhook export target (Format: Excel) POSTs the raw .xlsx bytes
// directly as the request body — Content-Type:
// application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, no
// multipart wrapping. Confirmed via a live schedule fire on 2026-08-12.
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// One property doesn't follow the "Samesun {City}" convention — it's
// branded separately in Mews as "The Guesthouse Vancouver Downtown".
const SPECIAL_CASE_PROPERTIES = {
  "The Guesthouse Vancouver Downtown": "Guesthouse Vancouver",
};

function getPropertyCity(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets["Parameters"];
  if (!sheet) {
    throw new Error("Workbook missing 'Parameters' sheet — can't read property name from B3");
  }
  const cell = sheet["B3"];
  const propertyName = cell ? String(cell.v).trim() : "";
  if (!propertyName) {
    throw new Error("Cell B3 on 'Parameters' sheet is empty — can't determine property");
  }
  if (propertyName in SPECIAL_CASE_PROPERTIES) {
    return SPECIAL_CASE_PROPERTIES[propertyName];
  }
  if (!propertyName.startsWith("Samesun ")) {
    throw new Error(`Unexpected property name format "${propertyName}" — expected "Samesun {City}"`);
  }
  return propertyName.slice("Samesun ".length).trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  if (req.query.token !== process.env.MEWS_IMPORT_SECRET) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const reportKey = req.query.report;
  const reportType = REPORT_TYPES[reportKey];
  if (!reportType) {
    res.status(400).json({
      success: false,
      error: `Missing or invalid ?report= param — expected one of: ${Object.keys(REPORT_TYPES).join(", ")}`,
    });
    return;
  }

  try {
    // Real Mews schedules POST the raw .xlsx bytes as the body (Format:
    // Excel, no multipart wrapping). Multipart is also accepted so manual
    // `curl -F "file=@..."` testing keeps working.
    const contentType = req.headers["content-type"] || "";
    const fileBuffer = contentType.includes("multipart/form-data")
      ? await parseMultipartFile(req)
      : await readRawBody(req);
    const city = getPropertyCity(fileBuffer);
    const { monthName, year, sortable: month } = getPreviousMonth();

    const filename = `${monthName} ${year} ${city} ${reportType}.xlsx`;

    // All imports land in one flat folder — the real Month > Report Type
    // drill-down lives in the By Month tab (ByMonth.jsx), driven by the
    // city/month/report_type tag columns below. Nesting folders to match
    // would just duplicate that same navigation a second way.
    const importsFolder = await getOrCreateFolder({ name: IMPORTS_FOLDER_NAME, parentId: null });

    // Overwrite behavior: same city + month + report_type replaces the
    // previous file rather than creating a duplicate.
    const { data: existingDoc, error: lookupError } = await supabase
      .from("documents")
      .select("*")
      .eq("section", SECTION)
      .eq("city", city)
      .eq("month", month)
      .eq("report_type", reportType)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existingDoc) {
      await supabase.storage.from("hub-files").remove([existingDoc.storage_path]);
      const { error: deleteError } = await supabase.from("documents").delete().eq("id", existingDoc.id);
      if (deleteError) throw deleteError;
    }

    const storagePath = `${SECTION}/${randomUUID()}-${filename}`;

    const { error: uploadError } = await supabase.storage.from("hub-files").upload(storagePath, fileBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (uploadError) throw uploadError;

    const { data: inserted, error: dbError } = await supabase
      .from("documents")
      .insert({
        section: SECTION,
        folder_id: importsFolder.id,
        name: filename,
        storage_path: storagePath,
        size_bytes: fileBuffer.length,
        city,
        month,
        report_type: reportType,
      })
      .select()
      .single();
    if (dbError) throw dbError;

    res.status(200).json({
      success: true,
      city,
      month,
      report_type: reportType,
      filename,
      overwritten: Boolean(existingDoc),
      document_id: inserted.id,
    });
  } catch (err) {
    console.error("mews-import error:", err);
    res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}
