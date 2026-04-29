"use client"

import { FormEvent, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function ListaEsperaPage() {
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState("")

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setErro("")

    try {
      const response = await fetch("/api/lista-espera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, whatsapp }),
      })
      const payload = await response.json()

      if (!response.ok || !payload?.ok) {
        setErro(payload?.error || "Não foi possível concluir o cadastro.")
        return
      }

      setSucesso(true)
      setNome("")
      setEmail("")
      setWhatsapp("")
    } catch {
      setErro("Erro de rede ao enviar o cadastro.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Lista de espera</CardTitle>
            <CardDescription>Cadastre seus dados para receber novidades da plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            {sucesso ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Cadastro realizado com sucesso. Permaneça no grupo: assim que tivermos novidades, vamos informar no grupo.
              </div>
            ) : (
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    required
                  />
                </div>
                {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Enviando..." : "Entrar na lista de espera"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
