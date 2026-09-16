import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30;

export async function createClient() {
  const cookieStore = await cookies();
  const rememberMe = cookieStore.get("remember_me")?.value === "1";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(
                name,
                value,
                rememberMe
                  ? { ...options, maxAge: REMEMBER_ME_MAX_AGE }
                  : options
              );
            });
          } catch {
            // La scrittura dei cookie può essere gestita dal proxy.
          }
        },
      },
    }
  );
}
