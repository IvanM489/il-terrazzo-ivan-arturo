import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getAdmin() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const supabase = adminClient();
  const { data: profile } = await supabase.from("profiles").select("ruolo").eq("id", user.id).single();
  return profile?.ruolo === "admin" ? user : null;
}

export async function GET() {
  try {
    const user = await getAdmin();
    if (!user) return NextResponse.json({ error: "Accesso riservato agli amministratori." }, { status: 403 });
    const supabase = adminClient();
    const { data: logs, error } = await supabase.from("activity_logs").select("id,user_id,action,details,created_at").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    const ids = [...new Set((logs || []).map((l) => l.user_id).filter(Boolean))];
    let profiles = [];
    if (ids.length) {
      const { data, error: profileError } = await supabase.from("profiles").select("id,nome").in("id", ids);
      if (profileError) throw profileError;
      profiles = data || [];
    }
    const names = new Map(profiles.map((p) => [p.id, p.nome]));
    return NextResponse.json({ logs: (logs || []).map((log) => ({ ...log, user_name: names.get(log.user_id) || null })) });
  } catch (error) {
    console.error("Errore caricamento log:", error);
    return NextResponse.json({ error: error?.message || "Errore nel caricamento del log." }, { status: 500 });
  }
}
