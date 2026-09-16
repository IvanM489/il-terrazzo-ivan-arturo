import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAuthenticatedUser() {
  const authClient = await createClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) return null;
  return user;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const supabase = createAdminClient();

    // Read the role with the service-role client so the log endpoint is not
    // affected by the profiles RLS policy.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("ruolo")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.ruolo !== "admin") {
      return NextResponse.json(
        { error: "Accesso negato" },
        { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

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

      // A missing/deleted profile must never make the entire log disappear.
      if (!profilesError) profiles = data || [];
    }

    const names = new Map(profiles.map((profile) => [profile.id, profile.nome]));

    return NextResponse.json(
      (logs || []).map((log) => ({
        ...log,
        user_name: names.get(log.user_id) || "Utente",
      })),
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Errore caricamento log:", error);
    return NextResponse.json(
      { error: error?.message || "Errore durante il caricamento del log." },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
