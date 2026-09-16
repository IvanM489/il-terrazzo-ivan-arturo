import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30;

export async function proxy(request) {
  let response = NextResponse.next({
    request,
  });

  const rememberMe = request.cookies.get("remember_me")?.value === "1";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                rememberMe
                  ? { ...options, maxAge: REMEMBER_ME_MAX_AGE }
                  : options
              );
            }
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Se esiste già una sessione valida, non mostrare nuovamente
  // la pagina di login: porta direttamente l'utente alla home.
  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // La pagina di recupero password resta accessibile senza autenticazione.
  if (pathname === "/recupero-password") {
    return response;
  }

  // Le API gestiscono autonomamente l'autenticazione
  // e devono restituire JSON invece di essere
  // reindirizzate alla pagina /login.
  const isApiRoute = pathname.startsWith("/api/");

  // Tutto ciò che non è API richiede autenticazione
  // tramite redirect alla pagina di login.
  if (!user && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);

    return NextResponse.redirect(url);
  }

  // Tutta la sezione /admin richiede ruolo admin.
  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("ruolo")
      .eq("id", user.id)
      .single();

    if (!profile || profile.ruolo !== "admin") {
      return NextResponse.redirect(
        new URL("/", request.url)
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
