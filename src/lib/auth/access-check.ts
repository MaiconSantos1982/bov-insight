import { createClient } from "@supabase/supabase-js"

export type AssinaturaStatus = "ATIVA" | "TRIAL" | "INADIMPLENTE" | "CANCELADA" | "EXPIRADA"

export type AccessResult = {
  allowed: boolean
  motivo: string
  usuario: {
    usuario_id: string
    nome: string | null
    email: string | null
    status_perfil: string | null
  } | null
  assinatura: {
    id: string
    plano: string
    status: string
    proximo_vencimento: string
  } | null
}

export function normalizeEmail(value: string | undefined): string | null {
  const trimmed = (value || "").trim().toLowerCase()
  return trimmed.includes("@") ? trimmed : null
}

function pickBestStatus(statuses: AssinaturaStatus[]): AssinaturaStatus | null {
  const priority: AssinaturaStatus[] = ["ATIVA", "TRIAL", "INADIMPLENTE", "CANCELADA", "EXPIRADA"]
  for (const item of priority) {
    if (statuses.includes(item)) return item
  }
  return null
}

export function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return { client: null, error: "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios." }
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return { client, error: null as string | null }
}

export async function checkAccessByEmail(email: string): Promise<{ ok: true; result: AccessResult } | { ok: false; error: string }> {
  const { client, error } = getAdminClient()
  if (!client) return { ok: false, error: error || "Erro ao criar client Supabase." }

  const { data: perfil, error: perfilError } = await client
    .from("boigordo_usuarios_perfil")
    .select("usuario_id,nome,email,status")
    .ilike("email", email)
    .limit(1)
    .maybeSingle()

  if (perfilError) return { ok: false, error: perfilError.message }

  if (!perfil?.usuario_id) {
    return {
      ok: true,
      result: {
        allowed: false,
        motivo: "USUARIO_NAO_ENCONTRADO",
        usuario: null,
        assinatura: null,
      },
    }
  }

  const { data: assinaturas, error: assinaturasError } = await client
    .from("boigordo_assinaturas")
    .select("id,plano,status,proximo_vencimento,updated_at,created_at")
    .eq("usuario_id", perfil.usuario_id)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20)

  if (assinaturasError) return { ok: false, error: assinaturasError.message }

  const rows = assinaturas || []
  const statuses = rows
    .map((item) => item.status)
    .filter((s): s is AssinaturaStatus =>
      s === "ATIVA" || s === "TRIAL" || s === "INADIMPLENTE" || s === "CANCELADA" || s === "EXPIRADA"
    )

  const bestStatus = pickBestStatus(statuses)
  const allowed = bestStatus === "ATIVA" || bestStatus === "TRIAL"

  const assinaturaRef =
    rows.find((item) => item.status === "ATIVA") ||
    rows.find((item) => item.status === "TRIAL") ||
    rows[0] ||
    null

  return {
    ok: true,
    result: {
      allowed,
      usuario: {
        usuario_id: perfil.usuario_id,
        nome: perfil.nome,
        email: perfil.email,
        status_perfil: perfil.status,
      },
      assinatura: assinaturaRef
        ? {
            id: assinaturaRef.id,
            plano: assinaturaRef.plano,
            status: assinaturaRef.status,
            proximo_vencimento: assinaturaRef.proximo_vencimento,
          }
        : null,
      motivo: allowed ? "ACESSO_LIBERADO" : bestStatus ? `ASSINATURA_${bestStatus}` : "SEM_ASSINATURA",
    },
  }
}
