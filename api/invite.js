import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!serviceKey) return res.status(500).json({
    error: "SUPABASE_SERVICE_ROLE_KEY not set in Vercel. Add it under Vercel > Settings > Environment Variables then redeploy."
  });
  if (!supabaseUrl) return res.status(500).json({ error: "SUPABASE_URL not configured." });

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { name, email, role, department, jobTitle, capacity, teamId, phone } = req.body || {};
    if (!email || !name) return res.status(400).json({ error: "Name and email are required." });

    const { data: emp, error: empErr } = await admin
      .from("employees")
      .upsert({ name, email, department: department || "General", role: jobTitle || "Team Member", capacity: +capacity || 40, active: true }, { onConflict: "email" })
      .select().single();
    if (empErr) return res.status(400).json({ error: "Employee: " + empErr.message });

    const siteUrl = process.env.SITE_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : null)
      || (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : null)
      || "http://localhost:5173";

    const { data: authData, error: authErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl,
      data: { name, role: role || "user", employee_id: emp.id }
    });
    if (authErr) return res.status(400).json({ error: "Invite: " + authErr.message });

    const colors = ["#06D6A0","#8B5CF6","#3B82F6","#F59E0B","#EF4444","#10B981"];
    await admin.from("app_users").upsert({
      id: authData.user.id, name, email, role: role || "user",
      employee_id: emp.id, team_id: teamId || null, phone: phone || null,
      is_active: true, avatar_color: colors[Math.floor(Math.random() * colors.length)]
    }, { onConflict: "id" });

    if (teamId && emp.id) {
      await admin.from("team_members").upsert({ team_id: teamId, employee_id: emp.id }, { onConflict: "team_id,employee_id" });
    }

    return res.status(200).json({ success: true, employeeId: emp.id });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected error" });
  }
}
