"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AdminSubnav } from "@/components/admin-subnav"
import { useData } from "@/lib/data-provider"

function formatStatus(status: "PENDENTE" | "PROCESSADO" | "FALHA") {
  if (status === "PROCESSADO") return "Processado"
  if (status === "FALHA") return "Falha"
  return "Pendente"
}

export default function AdminWebhooksPage() {
  const { billingEventos, adminAssinantes } = useData()

  const assinanteByUsuarioId = useMemo(() => {
    const map = new Map<string, { nome: string; email: string | null; telefone_whatsapp: string }>()
    for (const item of adminAssinantes) {
      map.set(item.usuario_id, {
        nome: item.nome,
        email: item.email,
        telefone_whatsapp: item.telefone_whatsapp,
      })
    }
    return map
  }, [adminAssinantes])

  const processados = billingEventos.filter((item) => item.status_processamento === "PROCESSADO").length
  const falhas = billingEventos.filter((item) => item.status_processamento === "FALHA").length
  const pendentes = billingEventos.filter((item) => item.status_processamento === "PENDENTE").length

  return (
    <>
      <PageHeader title="Admin · Webhooks" description="Entrada de eventos de pagamento e assinatura" showDatePicker={false}>
        <AdminSubnav />
      </PageHeader>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Processados</p><p className="text-2xl font-bold mt-1">{processados}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Falhas</p><p className="text-2xl font-bold mt-1">{falhas}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Pendentes</p><p className="text-2xl font-bold mt-1">{pendentes}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Eventos recebidos</CardTitle>
            <CardDescription>Últimos eventos do endpoint /api/billing/webhook</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Recebido em</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Evento</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Assinante</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Provider Event ID</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Erro</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billingEventos.slice(0, 500).map((item) => {
                    const assinante = item.usuario_id ? assinanteByUsuarioId.get(item.usuario_id) : null
                    return (
                      <tr key={item.id} className="border-b border-border/30 hover:bg-muted/30 align-top">
                        <td className="py-2.5 px-3 whitespace-nowrap">{format(new Date(item.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{item.event_type}</td>
                        <td className="py-2.5 px-3">
                          {assinante
                            ? <div><p className="font-medium">{assinante.nome}</p><p className="text-xs text-muted-foreground">{assinante.email || assinante.telefone_whatsapp}</p></div>
                            : <span className="text-muted-foreground">Não vinculado</span>}
                        </td>
                        <td className="py-2.5 px-3"><code className="text-xs">{item.provider_event_id}</code></td>
                        <td className="py-2.5 px-3">{item.erro || "—"}</td>
                        <td className="text-right py-2.5 px-3">
                          <Badge variant={item.status_processamento === "PROCESSADO" ? "default" : item.status_processamento === "FALHA" ? "secondary" : "outline"}>
                            {formatStatus(item.status_processamento)}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                  {billingEventos.length === 0 && (
                    <tr><td colSpan={6} className="py-8 px-3 text-center text-muted-foreground">Sem eventos de webhook até o momento.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
