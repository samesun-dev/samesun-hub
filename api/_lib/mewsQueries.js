// api/_lib/mewsQueries.js
//
// Read queries for the voucher dashboard. `db` is anything with
// `.query(text, params)`. Everything here reads only the PII-free
// `mews.reservations` / `mews.imports` tables.
//
// Dates are filtered/bucketed on their UTC calendar date (Mews stores UTC
// instants) — same known simplification as the standalone summary tool.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(query) {
  const f = {
    from: DATE_RE.test(query.from ?? "") ? query.from : null,
    to: DATE_RE.test(query.to ?? "") ? query.to : null,
    // Which date the range applies to: when the code was used (booking
    // date) or when the guest stays. Whitelisted — interpolated into SQL.
    basis: query.basis === "arrival" ? "arrival" : "created_at",
    properties: (query.properties ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 50),
    // Beth's rule: a "promo use" is a code the guest typed into the online
    // booking engine. Default on; off shows desk-entered tags too.
    onlineOnly: query.online !== "0",
    includeCancelled: query.cancelled === "1",
  };
  return f;
}

function buildWhere(f) {
  const clauses = [];
  const params = [];
  const col = f.basis; // 'created_at' | 'arrival'
  if (f.from) {
    params.push(f.from);
    clauses.push(`${col} >= ($${params.length}::date)::timestamp at time zone 'UTC'`);
  }
  if (f.to) {
    params.push(f.to);
    clauses.push(`${col} < (($${params.length}::date) + 1)::timestamp at time zone 'UTC'`);
  }
  if (f.properties.length) {
    params.push(f.properties);
    clauses.push(`property = any($${params.length}::text[])`);
  }
  if (f.onlineOnly) clauses.push("online");
  if (!f.includeCancelled) clauses.push("status is distinct from 'Canceled'");
  return { where: clauses.length ? `where ${clauses.join(" and ")}` : "", params };
}

export async function queryVouchers(db, f) {
  const { where, params } = buildWhere(f);
  const col = f.basis;

  const propertiesP = db.query(
    `select property, max(currency) as currency, max(received_at) as last_import
       from mews.imports group by property order by property`
  );

  // One row per voucher x property x status; the page merges them.
  const summaryP = db.query(
    `select voucher, property, currency, coalesce(status, '(unknown)') as status,
            count(*)::int                       as uses,
            coalesce(sum(nights), 0)::int       as nights,
            coalesce(sum(revenue), 0)::float8   as revenue,
            min(created_at) as first_booked, max(created_at) as last_booked,
            min(arrival)    as first_arrival, max(arrival)    as last_arrival,
            min(departure)  as first_departure, max(departure) as last_departure
       from mews.reservations
       ${where}
      group by voucher, property, currency, status`,
    params
  );

  const monthlyP = db.query(
    `select voucher, property,
            to_char(date_trunc('month', ${col} at time zone 'UTC'), 'YYYY-MM') as month,
            count(*)::int as uses
       from mews.reservations
       ${where}${where ? " and" : "where"} ${col} is not null
      group by voucher, property, month`,
    params
  );

  const [properties, summary, monthly] = await Promise.all([propertiesP, summaryP, monthlyP]);
  return { properties: properties.rows, summary: summary.rows, monthly: monthly.rows };
}
