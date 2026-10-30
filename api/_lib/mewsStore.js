// api/_lib/mewsStore.js
//
// Writes a parsed (already PII-free) Reservation Report into the isolated
// `mews` schema. `db` is anything with `.query(text, params)` (a pg Pool in
// production). One atomic statement: upsert the reservations and log the
// import. Upsert key is (property, reservation_id), so overlapping report
// windows / re-sends update status instead of duplicating.

const STORE_SQL = `
with up as (
  insert into mews.reservations as r (
    property, currency, reservation_id, reservation_number, status,
    created_at, arrival, departure, nights, persons, online, voucher,
    revenue, rate, segment, source, space_category, nationality
  )
  select
    $1::text, $2::text, x.reservation_id, x.reservation_number, x.status,
    x.created_at, x.arrival, x.departure, x.nights, x.persons, x.online, x.voucher,
    x.revenue, x.rate, x.segment, x.source, x.space_category, x.nationality
  from jsonb_to_recordset($3::jsonb) as x(
    reservation_id text, reservation_number text, status text,
    created_at timestamptz, arrival timestamptz, departure timestamptz,
    nights integer, persons integer, online boolean, voucher text,
    revenue numeric, rate text, segment text, source text,
    space_category text, nationality text
  )
  on conflict (property, reservation_id) do update set
    currency = excluded.currency,
    reservation_number = excluded.reservation_number,
    status = excluded.status,
    created_at = excluded.created_at,
    arrival = excluded.arrival,
    departure = excluded.departure,
    nights = excluded.nights,
    persons = excluded.persons,
    online = excluded.online,
    voucher = excluded.voucher,
    revenue = excluded.revenue,
    rate = excluded.rate,
    segment = excluded.segment,
    source = excluded.source,
    space_category = excluded.space_category,
    nationality = excluded.nationality,
    updated_at = now()
  returning 1
)
insert into mews.imports (
  property, currency, report_filter, window_start, window_end,
  report_statuses, rows_in_report, rows_stored
)
select $1::text, $2::text, $4::text, $5::text, $6::text, $7::text, $8::int,
       (select count(*)::int from up)
returning rows_stored
`;

export async function storeReport(db, report) {
  const { property, currency, window, reservationsInReport, rows } = report;
  const result = await db.query(STORE_SQL, [
    property,
    currency,
    JSON.stringify(rows),
    window.filter,
    window.start,
    window.end,
    window.statuses,
    reservationsInReport,
  ]);
  return result.rows[0].rows_stored;
}
