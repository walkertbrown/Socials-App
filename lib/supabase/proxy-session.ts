import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and gates pages behind login.
// Called from proxy.ts (the Next 16 replacement for middleware).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /api/cron/* runs with no logged-in user and guards itself with a secret.
  // /sw.js + /manifest.json must be served as static files (the service worker
  // can't be a login redirect), so let them through unauthenticated too.
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/webhooks") ||
    path === "/sw.js" ||
    path === "/manifest.json";

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/board";
    return NextResponse.redirect(url);
  }

  return response;
}
