import crypto from "crypto"

export const AUTH_COOKIE_NAME = "bovinsight_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 dias

type SessionPayload = {
  userId: string
  email: string
  nome: string | null
  tier: "FREE" | "PRO" | "SUPER_ADMIN"
  exp: number
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function getSessionSecret(): string {
  const secret =
    process.env.AUTH_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET

  if (secret) return secret

  return "bovinsight-temporary-secret-change-me"
}

function signPayload(encodedPayload: string): string {
  const secret = getSessionSecret()
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url")
}

export function createSessionToken(user: {
  userId: string
  email: string
  nome: string | null
  tier: "FREE" | "PRO" | "SUPER_ADMIN"
}): { token: string; expiresAtEpoch: number; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload: SessionPayload = {
    userId: user.userId,
    email: user.email,
    nome: user.nome,
    tier: user.tier,
    exp,
  }

  const encoded = base64UrlEncode(JSON.stringify(payload))
  const sig = signPayload(encoded)
  return {
    token: `${encoded}.${sig}`,
    expiresAtEpoch: exp,
    maxAge: SESSION_TTL_SECONDS,
  }
}

export function verifySessionToken(token: string | null | undefined): SessionPayload | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null

  const [encoded, receivedSig] = parts
  const expectedSig = signPayload(encoded)
  const receivedBuffer = Buffer.from(receivedSig)
  const expectedBuffer = Buffer.from(expectedSig)
  if (receivedBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null
  }

  try {
    const decoded = base64UrlDecode(encoded)
    const payload = JSON.parse(decoded) as SessionPayload
    if (!payload?.userId || !payload?.email || !payload?.exp || !payload?.tier) return null
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return null
    return payload
  } catch {
    return null
  }
}

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const pairs = cookieHeader.split(";")
  for (const pair of pairs) {
    const [k, ...rest] = pair.trim().split("=")
    if (k === name) return rest.join("=")
  }
  return null
}

export function getSessionFromCookieHeader(cookieHeader: string | null): SessionPayload | null {
  const token = readCookieValue(cookieHeader, AUTH_COOKIE_NAME)
  return verifySessionToken(token)
}
