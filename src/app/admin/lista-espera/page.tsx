"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminSubnav } from "@/components/admin-subnav"

type ListaEsperaItem = {
  id: string
  nome: string
  email: string
  whatsapp: string
  created_at: string
}

export default function AdminListaEsperaPage() {
  const [rows, setRows] = useState<ListaEsperaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")

  useEffect(() => {
    async function carregar() {
      setLoading(true)
      setErro("")
      try {
        const response = await fetch("/api/admin/lista-espera", { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok || !payload?.ok) {
          setErro(payload?.error || "Não foi possível carregar a lista.")
          return
        }
        setRows(payload.rows || [])
      } catch {
        setErro("Erro de rede ao carregar a lista.")
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  return (
    <>
      <PageHeader title="Admin · Lista de Espera" description="Pessoas interessadas em assinar a plataforma" showDatePicker={false}>
        <AdminSubnav />
      </PageHeader>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastros</CardTitle>
            <CardDescription>Total: {rows.length}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
            {!loading && !erro ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nome</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">E-mail</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">WhatsApp</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.id} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="px-3 py-2.5">{item.nome}</td>
                        <td className="px-3 py-2.5">{item.email}</td>
                        <td className="px-3 py-2.5">{item.whatsapp}</td>
                        <td className="px-3 py-2.5">
                          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                          Nenhum cadastro encontrado.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
