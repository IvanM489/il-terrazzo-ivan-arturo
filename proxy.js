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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // /login deve poter essere caricata anche con una sessione già attiva.
  // Il client della pagina login verifica la sessione e porta l'utente alla home.
  if (pathname === "/login" || pathname === "/recupero-password") {
    return response;
  }

  const isApiRoute = pathname.startsWith("/api/");

  if (!user && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);

    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("ruolo")
      .eq("id", user.id)
      .single();

    if (!profile || profile.ruolo !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
