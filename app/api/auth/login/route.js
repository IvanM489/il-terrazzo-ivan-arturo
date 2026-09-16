import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { logActivity } from "../../../../lib/activity-log";

const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request) {
  try {
    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e password sono obbligatorie." },
        { status: 400 }
      );
    }

    // Gestiamo esplicitamente i cookie sulla risposta HTTP.
    // In questo modo il flag "Ricordami" viene realmente persistito
    // insieme ai cookie di sessione Supabase.
    const response = NextResponse.json({ success: true });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                rememberMe
                  ? { ...options, maxAge: REMEMBER_ME_MAX_AGE }
                  : options
              );
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email).trim(),
      password: String(password),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Cookie separato che indica la scelta dell'utente.
    // Viene scritto solo dopo un login riuscito.
    response.cookies.set("remember_me", rememberMe ? "1" : "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: rememberMe ? REMEMBER_ME_MAX_AGE : 0,
    });

    await logActivity(data.user.id, "Login");

    return response;
  } catch (error) {
    console.error("Errore login:", error);
    return NextResponse.json(
      { error: error?.message || "Errore durante l'accesso." },
      { status: 500 }
    );
  }
}
