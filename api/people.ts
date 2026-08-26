// api/people.ts
//
// Vercel Serverless Function (Vite project — not Next.js).
// Lets any logged-in samesun-hub user manage who has access, without
// anyone going into the Supabase dashboard directly. samesun-hub has no
// roles/teams — access is all-or-nothing, so this intentionally has no
// extra admin check beyond "is a valid logged-in user of this project",
// matching the app's existing security model.
//
// GET    -> list everyone with access
// POST   -> invite a new person (creates the Auth user, emails them a
//           link to set their own password)
// DELETE -> remove someone's access

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCaller(req: VercelRequest) {
  const authHeader = (req.headers.authorization as string) ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const caller = await getCaller(req);
  if (!caller) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method === "GET") {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    const people = data.users
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: (u.user_metadata as { name?: string })?.name || u.email,
        createdAt: u.created_at,
        confirmed: !!u.confirmed_at,
      }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    res.status(200).json({ people });
    return;
  }

  if (req.method === "POST") {
    const { name, email, redirectTo } = (req.body ?? {}) as {
      name?: string;
      email?: string;
      redirectTo?: string;
    };
    if (!email?.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      {
        data: { name: name?.trim() || "" },
        ...(redirectTo ? { redirectTo } : {}),
      }
    );
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(200).json({ user: data.user });
    return;
  }

  if (req.method === "DELETE") {
    const { id } = (req.body ?? {}) as { id?: string };
    if (!id) {
      res.status(400).json({ error: "id is required" });
      return;
    }
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
