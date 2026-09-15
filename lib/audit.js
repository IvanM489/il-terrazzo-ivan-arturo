import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function writeAuditLog({ userId, action, details = null, path = null }) {
  if (!userId || !action) return;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      details,
      path,
    });

    if (error) console.error("Errore scrittura audit log:", error);
  } catch (error) {
    console.error("Errore scrittura audit log:", error);
  }
}
