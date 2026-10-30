// api/mews-vouchers.js
//
// Vercel Serverless Function (Vite project — not Next.js).
// Read API for the Vouchers dashboard (src/pages/Vouchers.jsx).
//
//   GET /api/mews-vouchers?from=YYYY-MM-DD&to=YYYY-MM-DD
//       &basis=created|arrival&properties=Samesun Banff,Samesun Toronto
//       &online=1|0&cancelled=0|1
//
// Auth: same model as api/people.ts — any logged-in hub user (Bearer JWT).
// Data: the isolated `mews` schema, read through the scoped `mews_app`
// role (MEWS_DATABASE_URL), not the project-wide service-role key.

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { createVouchersHandler } from "./_lib/mewsVouchersHandler.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let pool;
function getDb() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.MEWS_DATABASE_URL,
      max: 1,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function authenticate(req) {
  const jwt = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await supabase.auth.getUser(jwt);
  return error || !data.user ? null : data.user;
}

export default createVouchersHandler({ authenticate, getDb });
