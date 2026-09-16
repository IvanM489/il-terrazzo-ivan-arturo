import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { logActivity } from "../../../../lib/activity-log";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await logActivity(user.id, "Logout");
      await supabase.auth.signOut({ scope: "local" });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore logout:", error);
    return NextResponse.json({ error: "Errore durante il logout." }, { status: 500 });
  }
}
