import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function checkAdmin() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { user: null, admin: false };

  const { data: profile } = await authClient
    .from("profiles")
    .select("ruolo")
    .eq("id", user.id)
    .single();

  return { user, admin: profile?.ruolo === "admin" };
}

export async function GET() {
  try {
    const { user, admin } = await checkAdmin();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!admin) return NextResponse.json({ error: "Accesso negato" }, { status: 403 });

    const supabase = createAdminClient();
    const { data: logs, error } = await supabase
      .from("activity_logs")
      .select("id, created_at, user_id, action, details")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const userIds = [...new Set((logs || []).map((log) => log.user_id).filter(Boolean))];
    let profiles = [];

    if (userIds.length) {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", userIds);
      if (profilesError) throw profilesError;
      profiles = data || [];
    }

    const names = new Map(profiles.map((profile) => [profile.id, profile.nome]));

    return NextResponse.json(
      (logs || []).map((log) => ({
        ...log,
        user_name: names.get(log.user_id) || "Utente",
      }))
    );
  } catch (error) {
    console.error("Errore caricamento log:", error);
    return NextResponse.json(
      { error: error?.message || "Errore durante il caricamento del log." },
      { status: 500 }
    );
  }
}
