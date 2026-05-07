import { getSessionFromCookieHeader } from "@/lib/auth/session"

export type AuthSession = {
  userId: string
  email: string
  nome: string | null
  tier: "FREE" | "PRO" | "SUPER_ADMIN"
}

export function getAuthenticatedSession(request: Request): AuthSession | null {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"))
  if (!session) return null
  return {
    userId: session.userId,
    email: session.email,
    nome: session.nome,
    tier: session.tier,
  }
}
