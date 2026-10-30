// api/_lib/mewsReservations.js
//
// Parses a Mews Reservation Report (.xlsx) into PII-free rows. Files under
// api/_lib are NOT deployed as routes (Vercel ignores underscore-prefixed
// paths) — this is a shared helper for api/mews-reservations.js.
//
// PRIVACY: ALLOWED_FIELDS is an allowlist. Only these columns are ever read
// from the Reservations sheet; guest name, email, phone, address, group
// name (contains the surname), payment card details, notes, and
// birthdates are never referenced, so they can't be stored or logged.
// Nothing in this file logs row contents.

import * as XLSX from "xlsx";

// Business rule from Beth (2026-09-19): a code only counts as a promo when
// the guest entered it through the online booking engine. We still store
// desk-entered voucher rows (flagged online=false) so the dashboard can
// change that rule later without a re-import; the dashboard filters.
export const ONLINE_ORIGIN = "Booking engine (Mews Booking Engine)";

// db column -> Mews header. `required` headers must exist or the report is
// rejected loudly rather than silently mis-parsed.
const ALLOWED_FIELDS = {
  reservation_id: { header: "Identifier", required: true },
  reservation_number: { header: "Number" },
  status: { header: "Status", required: true },
  created_at: { header: "Created", required: true },
  arrival: { header: "Arrival", required: true },
  departure: { header: "Departure", required: true },
  nights: { header: "Count (nights)", required: true },
  persons: { header: "Person count" },
  origin: { header: "Origin", required: true }, // reduced to `online` below, not stored raw
  voucher: { header: "Voucher", required: true },
  revenue: { header: "Total amount", required: true },
  rate: { header: "Rate" },
  segment: { header: "Segment" },
  source: { header: "Reservation source" },
  space_category: { header: "Space category" },
  nationality: { header: "Customer nationality" },
};

function getParameters(wb) {
  const ws = wb.Sheets["Parameters"];
  if (!ws) throw new Error("Missing 'Parameters' sheet — is this a Mews Reservation report?");
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: false });
  const params = {};
  for (const r of rows.slice(1)) {
    if (r[0] != null) params[String(r[0]).trim()] = r[1] == null ? "" : String(r[1]).trim();
  }
  const property = ws["B3"] ? String(ws["B3"].v).trim() : "";
  if (!property) throw new Error("Parameters!B3 is empty — can't determine property");
  return { property, params };
}

// Mews bakes the currency symbol into each money cell's formatted text
// (e.g. "C$411.46"), so it's read per file instead of hardcoded per property.
function detectCurrency(ws, colIndex) {
  const col = XLSX.utils.encode_col(colIndex);
  for (let r = 2; r < 20000; r++) {
    const cell = ws[`${col}${r}`];
    if (cell && cell.w) {
      const m = String(cell.w).match(/^([^\d.\-\s]+)/);
      if (m) return m[1].trim();
    }
  }
  return "$";
}

const toIso = (v) => (v instanceof Date && !isNaN(v) ? v.toISOString() : null);
const toInt = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Math.round(Number(v)));
const toText = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim());

export function parseReservationReport(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const { property, params } = getParameters(wb);

  const ws = wb.Sheets["Reservations"];
  if (!ws) throw new Error("Missing 'Reservations' sheet");
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
  const header = rows[0] || [];

  const idx = {};
  for (const [field, { header: name, required }] of Object.entries(ALLOWED_FIELDS)) {
    const i = header.indexOf(name);
    if (i === -1 && required) throw new Error(`Reservations sheet missing expected column "${name}"`);
    idx[field] = i;
  }

  const currency = detectCurrency(ws, idx.revenue);
  const out = [];
  let reservationsInReport = 0;

  for (const row of rows.slice(1)) {
    // Trailing "Total" footer (and any blank row) has no Identifier.
    if (!row[idx.reservation_id]) continue;
    reservationsInReport++;

    const voucher = toText(row[idx.voucher]);
    if (!voucher) continue;

    const get = (f) => (idx[f] === -1 ? null : row[idx[f]]);
    out.push({
      reservation_id: String(row[idx.reservation_id]),
      reservation_number: toText(get("reservation_number")),
      status: toText(get("status")),
      created_at: toIso(get("created_at")),
      arrival: toIso(get("arrival")),
      departure: toIso(get("departure")),
      nights: toInt(get("nights")),
      persons: toInt(get("persons")),
      online: get("origin") === ONLINE_ORIGIN,
      voucher,
      revenue: Number(get("revenue")) || 0,
      rate: toText(get("rate")),
      segment: toText(get("segment")),
      source: toText(get("source")),
      space_category: toText(get("space_category")),
      nationality: toText(get("nationality")),
    });
  }

  return {
    property,
    currency,
    window: {
      filter: params["Filter"] || null,
      start: params["Start"] || null,
      end: params["End"] || null,
      statuses: params["Status"] || null,
    },
    reservationsInReport,
    rows: out,
  };
}
