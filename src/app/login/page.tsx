"use client"

import { FormEvent, Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

const OFFER_URL = "https://payfast.greenn.com.br/adesj3f/offer/QwHQe4?utm_source=popup"
const SUPPORT_TEXT = "Não estou conseguindo acesso ao sistema Inteligência Pecuária"
const SUPPORT_URL = `https://wa.me/5551992049514?text=${encodeURIComponent(SUPPORT_TEXT)}`

type LoginBlockMode = "not_found" | "invalid_status" | null

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [signupNome, setSignupNome] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupWhatsapp, setSignupWhatsapp] = useState("")
  const [loading, setLoading] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [blockMode, setBlockMode] = useState<LoginBlockMode>(null)
  const [blockStatus, setBlockStatus] = useState<string>("")

  const next = searchParams.get("next") || "/"

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        if (response.ok) {
          router.replace(next)
        }
      } catch {
        // ignore
      }
    }
    checkSession()
  }, [router, next])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const payload = await response.json()

      if (!response.ok || !payload?.ok) {
        const motivo = String(payload?.motivo || "")
        const assinaturaStatus = String(payload?.assinatura?.status || "")

        if (motivo === "USUARIO_NAO_ENCONTRADO") {
          setBlockStatus("")
          setBlockMode("not_found")
          return
        }

        if (motivo === "SEM_ASSINATURA" || motivo.startsWith("ASSINATURA_")) {
          const status =
            assinaturaStatus ||
            (motivo.startsWith("ASSINATURA_") ? motivo.replace("ASSINATURA_", "") : "SEM_ASSINATURA")
          setBlockStatus(status)
          setBlockMode("invalid_status")
          return
        }

        toast.error("Falha no login", {
          description: payload?.hint || payload?.error || payload?.motivo || "Nao foi possivel autenticar.",
        })
        return
      }

      toast.success("Acesso liberado")
      window.location.href = next
    } catch {
      toast.error("Falha no login", { description: "Erro de rede ao autenticar." })
    } finally {
      setLoading(false)
    }
  }

  async function onForgotPassword() {
    if (!email.trim()) {
      toast.error("Recuperação de senha", { description: "Informe seu email para receber o link de recuperação." })
      return
    }
    setRecovering(true)
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        toast.error("Recuperação de senha", {
          description: payload?.details || payload?.error || "Não foi possível enviar o link.",
        })
        return
      }
      toast.success("Recuperação de senha", {
        description: "Se o email existir, você receberá o link de redefinição.",
      })
    } catch {
      toast.error("Recuperação de senha", { description: "Erro de rede ao solicitar recuperação." })
    } finally {
      setRecovering(false)
    }
  }

  async function onSignupSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: signupNome,
          email: signupEmail,
          password: signupPassword,
          telefone_whatsapp: signupWhatsapp,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        toast.error("Falha no cadastro", {
          description: payload?.error || "Nao foi possivel concluir seu cadastro.",
        })
        return
      }
      toast.success("Cadastro concluido")
      window.location.href = next
    } catch {
      toast.error("Falha no cadastro", { description: "Erro de rede ao cadastrar." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 text-white">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="font-semibold tracking-wide">Inteligência</p>
            <p className="text-sm text-white/80">Pecuária</p>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">Inteligencia de mercado para decisao no campo.</h1>
          <p className="text-white/85">
            Acompanhe indicadores CEPEA, configure alertas e concentre suas operacoes em um painel unico.
          </p>
        </div>

        <p className="text-xs text-white/70">© {new Date().getFullYear()} Inteligência Pecuária</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 bg-muted/20">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Entrar na plataforma</CardTitle>
            <CardDescription>
              Acesse com seu cadastro ou crie uma conta para usar o plano gratuito (Cotações).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 rounded-md border p-1">
              <Button type="button" variant={mode === "login" ? "default" : "ghost"} onClick={() => setMode("login")}>
                Entrar
              </Button>
              <Button type="button" variant={mode === "signup" ? "default" : "ghost"} onClick={() => setMode("signup")}>
                Cadastrar
              </Button>
            </div>

            {mode === "login" ? (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Validando..." : "Entrar"}
                </Button>

                <Button type="button" variant="link" className="h-auto w-full p-0 text-xs" onClick={onForgotPassword} disabled={recovering}>
                  {recovering ? "Enviando recuperação..." : "Esqueci minha senha"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Dificuldades para acessar? Fale com o suporte em{" "}
                  <Link href={SUPPORT_URL} className="text-primary hover:underline" target="_blank">
                    WhatsApp
                  </Link>
                  .
                </p>
              </form>
            ) : (
              <form onSubmit={onSignupSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-nome">Nome</Label>
                  <Input
                    id="signup-nome"
                    value={signupNome}
                    onChange={(e) => setSignupNome(e.target.value)}
                    placeholder="Seu nome"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-whatsapp">WhatsApp</Label>
                  <Input
                    id="signup-whatsapp"
                    type="tel"
                    value={signupWhatsapp}
                    onChange={(e) => setSignupWhatsapp(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    autoComplete="tel"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar conta"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={blockMode !== null} onOpenChange={(open) => !open && setBlockMode(null)}>
        <DialogContent>
          {blockMode === "not_found" ? (
            <>
              <DialogHeader>
                <DialogTitle>Acesso não liberado</DialogTitle>
                <DialogDescription>
                  Vi aqui que você não está registrado na nossa base. Para acessar o sistema Inteligência Pecuária faça sua assinatura agora.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-start">
                <Button asChild className="w-full sm:w-auto">
                  <Link href={OFFER_URL} target="_blank" rel="noreferrer">
                    Fazer assinatura agora
                  </Link>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Assinatura pendente de regularização</DialogTitle>
                <DialogDescription>
                  Localizamos seu cadastro mas sua assinatura está <strong>{blockStatus}</strong>.
                </DialogDescription>
                <DialogDescription>
                  Para renovar, toque no botão abaixo.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-start">
                <div className="w-full space-y-3">
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={OFFER_URL} target="_blank" rel="noreferrer">
                      Renovar assinatura
                    </Link>
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Caso a sua assinatura esteja em dia, fale com o suporte:
                  </p>
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href={SUPPORT_URL} target="_blank" rel="noreferrer">
                      Suporte via WhatsApp
                    </Link>
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
