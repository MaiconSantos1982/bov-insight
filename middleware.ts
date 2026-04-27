import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
const AUTH_COOKIE_NAME = "bovinsight_session"

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/consulta-acesso",
  "/api/billing/webhook",
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap")
  ) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value)

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 })
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
