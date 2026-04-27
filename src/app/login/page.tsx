"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function LoginPage() {
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_50%)]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entrar na plataforma</CardTitle>
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
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Validando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
