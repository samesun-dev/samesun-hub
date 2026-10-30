// api/_lib/mewsVouchersHandler.js
//
// Handler factory for GET /api/mews-vouchers. Dependencies are injected so
// the same code can be tested locally (fake auth + in-memory Postgres)
// without touching production credentials.

import { parseFilters, queryVouchers } from "./mewsQueries.js";

export function createVouchersHandler({ authenticate, getDb }) {
  return async function handler(req, res) {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const user = await authenticate(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const filters = parseFilters(req.query ?? {});
      const data = await queryVouchers(getDb(), filters);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json({ filters, ...data });
    } catch (err) {
      console.error("mews-vouchers error:", err instanceof Error ? err.message : String(err));
      res.status(500).json({ error: "Couldn't load voucher data" });
    }
  };
}
