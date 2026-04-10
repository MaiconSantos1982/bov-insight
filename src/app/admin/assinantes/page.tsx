"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { AdminSubnav } from "@/components/admin-subnav"
import { useData } from "@/lib/data-provider"
import { formatPhoneForDisplay } from "@/lib/phone-format"

const PAGE_SIZE = 50

type VencimentoFilter = "todos" | "vencidos" | "7d" | "30d" | "sem_vencimento"

function formatAssinaturaStatus(value: string | null): string {
  if (value === "ATIVA") return "Ativa"
  if (value === "TRIAL") return "Trial"
  if (value === "INADIMPLENTE") return "Inadimplente"
  if (value === "CANCELADA") return "Cancelada"
  if (value === "EXPIRADA") return "Expirada"
  return "N/D"
}

export default function AdminAssinantesPage() {
  const { adminAssinantes } = useData()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("todos")
  const [plano, setPlano] = useState("todos")
  const [vencimento, setVencimento] = useState<VencimentoFilter>("todos")
  const [page, setPage] = useState(1)

  const planoOptions = useMemo(() => {
    const set = new Set(adminAssinantes.map((item) => item.plano).filter(Boolean) as string[])
    return [...set].sort()
  }, [adminAssinantes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = new Date()

    return adminAssinantes.filter((item) => {
      const matchQuery =
        !q ||
        item.nome.toLowerCase().includes(q) ||
        (item.email || "").toLowerCase().includes(q) ||
        item.telefone_whatsapp.toLowerCase().includes(q) ||
        formatPhoneForDisplay(item.telefone_whatsapp).toLowerCase().includes(q)

      const matchStatus = status === "todos" || item.assinatura_status === status
      const matchPlano = plano === "todos" || item.plano === plano

      let matchVenc = true
      const vencDate = item.proximo_vencimento ? new Date(`${item.proximo_vencimento}T12:00:00`) : null
      if (vencimento === "sem_vencimento") {
        matchVenc = !vencDate
      } else if (vencimento !== "todos") {
        if (!vencDate) {
          matchVenc = false
        } else {
          const diffDays = Math.ceil((vencDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          if (vencimento === "vencidos") matchVenc = diffDays < 0
          if (vencimento === "7d") matchVenc = diffDays >= 0 && diffDays <= 7
          if (vencimento === "30d") matchVenc = diffDays >= 0 && diffDays <= 30
        }
      }

      return matchQuery && matchStatus && matchPlano && matchVenc
    })
  }, [adminAssinantes, query, status, plano, vencimento])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query, status, plano, vencimento])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <>
      <PageHeader title="Admin · Assinantes" description="Base completa de assinantes e status comercial" showDatePicker={false}>
        <AdminSubnav />
      </PageHeader>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assinantes</CardTitle>
            <CardDescription>Busca por nome, email ou telefone, com filtros por status, plano e vencimento</CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3">
              <Input placeholder="Buscar por nome, email ou telefone" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="ATIVA">Ativa</SelectItem>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                  <SelectItem value="EXPIRADA">Expirada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={plano} onValueChange={setPlano}>
                <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos planos</SelectItem>
                  {planoOptions.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={vencimento} onValueChange={(v) => setVencimento(v as VencimentoFilter)}>
                <SelectTrigger><SelectValue placeholder="Vencimento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos vencimentos</SelectItem>
                  <SelectItem value="vencidos">Vencidos</SelectItem>
                  <SelectItem value="7d">Vence em até 7 dias</SelectItem>
                  <SelectItem value="30d">Vence em até 30 dias</SelectItem>
                  <SelectItem value="sem_vencimento">Sem vencimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Nome</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Email</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Telefone</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Plano</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vencimento</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr key={`${item.usuario_id}-${item.assinatura_id || "n"}`} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2.5 px-3">{item.nome}</td>
                      <td className="py-2.5 px-3">{item.email || "N/D"}</td>
                      <td className="py-2.5 px-3">{formatPhoneForDisplay(item.telefone_whatsapp)}</td>
                      <td className="py-2.5 px-3">{item.plano || "N/D"}</td>
                      <td className="py-2.5 px-3">{item.proximo_vencimento ? format(new Date(`${item.proximo_vencimento}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "N/D"}</td>
                      <td className="text-right py-2.5 px-3"><Badge variant={item.assinatura_status === "ATIVA" ? "default" : item.assinatura_status === "INADIMPLENTE" ? "secondary" : "outline"}>{formatAssinaturaStatus(item.assinatura_status)}</Badge></td>
                    </tr>
                  ))}
                  {pageItems.length === 0 && (
                    <tr><td colSpan={6} className="py-8 px-3 text-center text-muted-foreground">Sem assinantes para os filtros selecionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                Exibindo {pageItems.length} de {filtered.length} resultado(s)
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
