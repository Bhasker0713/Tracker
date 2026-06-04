export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { createClient } = await import("@supabase/supabase-js");

  const adminSupabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { name, email, role, department, jobTitle, capacity, teamId, phone } = req.body;

  if (!email || !name) return res.status(400).json({ error: "Name and email are required" });

  try {
    // 1. Create employee record
    const { data: emp, error: empErr } = await adminSupabase
      .from("employees")
      .upsert({ name, email, department: department || "General",
        role: jobTitle || "Team Member", capacity: capacity || 40, active: true },
        { onConflict: "email" })
      .select().single();

    if (empErr) return res.status(400).json({ error: "Employee: " + empErr.message });

    // 2. Send Supabase auth invite
    const siteUrl = process.env.VERCEL_URL
      ? "https://" + process.env.VERCEL_URL
      : "http://localhost:5173";

    const { data: authData, error: authErr } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl,
      data: { name, role: role || "user", employee_id: emp.id }
    });

    if (authErr) return res.status(400).json({ error: "Auth invite: " + authErr.message });

    // 3. Create app_users profile
    const { error: profileErr } = await adminSupabase
      .from("app_users")
      .upsert({
        id: authData.user.id,
        name, email,
        role:        role        || "user",
        employee_id: emp.id,
        team_id:     teamId      || null,
        phone:       phone       || null,
        is_active:   true,
        avatar_color: ["#06D6A0","#8B5CF6","#3B82F6","#F59E0B","#EF4444","#10B981"][
          Math.floor(Math.random() * 6)
        ]
      }, { onConflict: "id" });

    if (profileErr) console.warn("Profile upsert warn:", profileErr.message);

    // 4. Add to team if provided
    if (teamId && emp.id) {
      await adminSupabase.from("team_members")
        .upsert({ team_id: teamId, employee_id: emp.id }, { onConflict: "team_id,employee_id" });
    }

    return res.status(200).json({ success: true, employeeId: emp.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
