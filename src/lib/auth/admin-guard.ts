import { NextResponse } from "next/server"
import { getAuthenticatedSession, type AuthSession } from "@/lib/auth/request-auth"

type SuperAdminGuardResult =
  | { ok: true; session: AuthSession }
  | { ok: false; response: NextResponse }

function isSuperAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const fromEnv = (process.env.SUPER_ADMIN_EMAILS || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  return normalized === "maiconsantos1982@gmail.com" || fromEnv.includes(normalized)
}

export function requireSuperAdmin(request: Request): SuperAdminGuardResult {
  const session = getAuthenticatedSession(request)
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 }),
    }
  }

  if (!isSuperAdminEmail(session.email)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Acesso restrito a super admin." }, { status: 403 }),
    }
  }

  return { ok: true, session }
}
