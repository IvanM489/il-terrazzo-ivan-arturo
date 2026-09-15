import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const body = await request.json();
    if (!body?.action) return NextResponse.json({ error: "Azione mancante." }, { status: 400 });

    const supabase = adminClient();
    const { error } = await supabase.from("activity_logs").insert({
      user_id: user.id,
      action: String(body.action).slice(0, 120),
      details: body.details ? String(body.details).slice(0, 500) : null,
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore registrazione log:", error);
    return NextResponse.json({ error: error?.message || "Errore nella registrazione del log." }, { status: 500 });
  }
}
