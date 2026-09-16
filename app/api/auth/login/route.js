import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { logActivity } from "../../../../lib/activity-log";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email e password sono obbligatorie." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim(),
      password: String(password),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    await logActivity(data.user.id, "Login");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore login:", error);
    return NextResponse.json(
      { error: error?.message || "Errore durante l'accesso." },
      { status: 500 }
    );
  }
}
