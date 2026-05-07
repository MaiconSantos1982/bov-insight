import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeEmail } from "@/lib/auth/access-check"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ForgotBody = {
  email?: string
}

export async function POST(request: Request) {
  let body: ForgotBody
  try {
    body = (await request.json()) as ForgotBody
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 })
  }

  const email = normalizeEmail(body.email)
  if (!email) {
    return NextResponse.json({ ok: false, error: "Email inválido." }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, error: "Configuração de autenticação ausente." }, { status: 500 })
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const origin = request.headers.get("origin") || ""
  const redirectTo = origin ? `${origin}/login` : undefined

  const { error } = await authClient.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Não foi possível enviar o link de recuperação.",
        details: error.message,
      },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, message: "Link de recuperação enviado para o email informado." })
}
