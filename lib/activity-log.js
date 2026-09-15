import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function logActivity(userId, action, details = null) {
  if (!userId) return;

  const supabase = adminClient();
  const { error } = await supabase.from("activity_logs").insert({
    user_id: userId,
    action: String(action || "").slice(0, 120),
    details: details ? String(details).slice(0, 500) : null,
  });

  if (error) {
    console.error("Errore registrazione activity log:", error);
  }
}
