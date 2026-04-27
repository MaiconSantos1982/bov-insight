"use client"

import { FormEvent, Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

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
        body: JSON.stringify({ email }),
      })
      const payload = await response.json()

      if (!response.ok || !payload?.ok) {
        toast.error("Falha no login", {
          description: payload?.error || payload?.motivo || "Nao foi possivel autenticar.",
        })
        return
      }

      toast.success("Acesso liberado")
      router.replace(next)
      router.refresh()
    } catch {
      toast.error("Falha no login", { description: "Erro de rede ao autenticar." })
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
            <p className="font-semibold tracking-wide">BovInsight</p>
            <p className="text-sm text-white/80">Inteligencia Pecuaria</p>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">Inteligencia de mercado para decisao no campo.</h1>
          <p className="text-white/85">
            Acompanhe indicadores CEPEA, configure alertas e concentre suas operacoes em um painel unico.
          </p>
        </div>

        <p className="text-xs text-white/70">© {new Date().getFullYear()} BovInsight</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 bg-muted/20">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Entrar na plataforma</CardTitle>
            <CardDescription>Use o email da sua assinatura para acessar o BovInsight.</CardDescription>
          </CardHeader>
          <CardContent>
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Validando..." : "Entrar"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Dificuldades para acessar? Fale com o suporte em{" "}
                <Link href="https://wa.me/5561994783325" className="text-primary hover:underline" target="_blank">
                  WhatsApp
                </Link>
                .
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
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
