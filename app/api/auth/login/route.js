import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "../../../../lib/supabase/server";
import { logActivity } from "../../../../lib/activity-log";

const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request) {
  try {
    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email e password sono obbligatorie." }, { status: 400 });
    }

    const cookieStore = await cookies();

    if (rememberMe) {
      cookieStore.set("remember_me", "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: REMEMBER_ME_MAX_AGE,
      });
    } else {
      cookieStore.set("remember_me", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
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
