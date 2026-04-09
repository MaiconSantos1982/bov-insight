"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AdminSubnav } from "@/components/admin-subnav"
import { useData } from "@/lib/data-provider"

export default function AdminLogsExecucaoPage() {
  const { execucoesLogs } = useData()

  const sucesso = execucoesLogs.filter((item) => item.status === "SUCESSO").length
  const falha = execucoesLogs.filter((item) => item.status === "FALHA").length
  const iniciado = execucoesLogs.filter((item) => item.status === "INICIADO").length

  return (
    <>
      <PageHeader title="Admin · Logs de Execucao" description="Monitoramento de jobs, workers e integrações" showDatePicker={false}>
        <AdminSubnav />
      </PageHeader>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Sucesso</p><p className="text-2xl font-bold mt-1">{sucesso}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Falha</p><p className="text-2xl font-bold mt-1">{falha}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Iniciado</p><p className="text-2xl font-bold mt-1">{iniciado}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Logs</CardTitle>
            <CardDescription>Últimos eventos operacionais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Quando</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Origem</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Tipo</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Mensagem</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Duração</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {execucoesLogs.slice(0, 200).map((item) => (
                    <tr key={item.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2.5 px-3">{format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                      <td className="py-2.5 px-3">{item.origem}</td>
                      <td className="py-2.5 px-3">{item.tipo}</td>
                      <td className="py-2.5 px-3">{item.mensagem || "—"}</td>
                      <td className="py-2.5 px-3">{item.duracao_ms != null ? `${item.duracao_ms} ms` : "—"}</td>
                      <td className="text-right py-2.5 px-3"><Badge variant={item.status === "SUCESSO" ? "default" : item.status === "FALHA" ? "secondary" : "outline"}>{item.status}</Badge></td>
                    </tr>
                  ))}
                  {execucoesLogs.length === 0 && (
                    <tr><td colSpan={6} className="py-8 px-3 text-center text-muted-foreground">Sem logs de execução.</td></tr>
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
