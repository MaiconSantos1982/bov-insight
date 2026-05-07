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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import type { AdminAssinante } from "@/lib/supabase"

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
  const [rows, setRows] = useState<AdminAssinante[]>([])
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("todos")
  const [plano, setPlano] = useState("todos")
  const [vencimento, setVencimento] = useState<VencimentoFilter>("todos")
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<AdminAssinante | null>(null)
  const [form, setForm] = useState({
    usuario_id: "",
    assinatura_id: "",
    nome: "",
    email: "",
    telefone_whatsapp: "",
    perfil_status: "ATIVO",
    plano: "FREE",
    assinatura_status: "ATIVA",
    ciclo: "MENSAL",
    proximo_vencimento: "",
    renovacao_automatica: false,
  })

  useEffect(() => {
    setRows(adminAssinantes)
  }, [adminAssinantes])

  const planoOptions = useMemo(() => {
    const set = new Set(rows.map((item) => item.plano).filter(Boolean) as string[])
    return [...set].sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = new Date()

    return rows.filter((item) => {
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
  }, [rows, query, status, plano, vencimento])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query, status, plano, vencimento])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  function openNew() {
    setEditing(null)
    setForm({
      usuario_id: "",
      assinatura_id: "",
      nome: "",
      email: "",
      telefone_whatsapp: "",
      perfil_status: "ATIVO",
      plano: "FREE",
      assinatura_status: "ATIVA",
      ciclo: "MENSAL",
      proximo_vencimento: "",
      renovacao_automatica: false,
    })
    setDialogOpen(true)
  }

  function openEdit(item: AdminAssinante) {
    setEditing(item)
    setForm({
      usuario_id: item.usuario_id,
      assinatura_id: item.assinatura_id || "",
      nome: item.nome || "",
      email: item.email || "",
      telefone_whatsapp: item.telefone_whatsapp || "",
      perfil_status: item.perfil_status || "ATIVO",
      plano: item.plano || "FREE",
      assinatura_status: item.assinatura_status || "ATIVA",
      ciclo: item.ciclo || "MENSAL",
      proximo_vencimento: item.proximo_vencimento || "",
      renovacao_automatica: Boolean(item.renovacao_automatica),
    })
    setDialogOpen(true)
  }

  async function refreshRows() {
    const response = await fetch("/api/admin/assinantes", { cache: "no-store" })
    const payload = await response.json()
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Falha ao atualizar lista.")
    setRows(payload.rows || [])
  }

  async function saveAssinante() {
    setSaving(true)
    try {
      const method = editing ? "PUT" : "POST"
      const response = await fetch("/api/admin/assinantes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          proximo_vencimento: form.proximo_vencimento || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Falha ao salvar assinante.")
      await refreshRows()
      setDialogOpen(false)
      toast.success(editing ? "Assinante atualizado" : "Assinante criado")
    } catch (error) {
      toast.error("Erro ao salvar", { description: error instanceof Error ? error.message : "Falha inesperada." })
    } finally {
      setSaving(false)
    }
  }

  async function deleteAssinante() {
    if (!editing?.usuario_id) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/assinantes?usuario_id=${encodeURIComponent(editing.usuario_id)}`, { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Falha ao excluir assinante.")
      await refreshRows()
      setDialogOpen(false)
      toast.success("Assinante excluído")
    } catch (error) {
      toast.error("Erro ao excluir", { description: error instanceof Error ? error.message : "Falha inesperada." })
    } finally {
      setSaving(false)
    }
  }

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
            <div className="pt-2">
              <Button size="sm" onClick={openNew}>Novo assinante</Button>
            </div>
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
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ações</th>
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
                      <td className="text-right py-2.5 px-3">
                        <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Abrir</Button>
                      </td>
                    </tr>
                  ))}
                  {pageItems.length === 0 && (
                    <tr><td colSpan={7} className="py-8 px-3 text-center text-muted-foreground">Sem assinantes para os filtros selecionados.</td></tr>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar assinante" : "Novo assinante"}</DialogTitle>
            <DialogDescription>Visualize e altere dados de perfil e assinatura.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <Input placeholder="Nome" value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
            <Input placeholder="WhatsApp" value={form.telefone_whatsapp} onChange={(e) => setForm((s) => ({ ...s, telefone_whatsapp: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.perfil_status} onValueChange={(value) => setForm((s) => ({ ...s, perfil_status: value }))}>
                <SelectTrigger><SelectValue placeholder="Status perfil" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.plano} onValueChange={(value) => setForm((s) => ({ ...s, plano: value }))}>
                <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">FREE</SelectItem>
                  <SelectItem value="PRO">PRO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.assinatura_status} onValueChange={(value) => setForm((s) => ({ ...s, assinatura_status: value }))}>
                <SelectTrigger><SelectValue placeholder="Status assinatura" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVA">Ativa</SelectItem>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="INADIMPLENTE">Inadimplente</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                  <SelectItem value="EXPIRADA">Expirada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.ciclo} onValueChange={(value) => setForm((s) => ({ ...s, ciclo: value }))}>
                <SelectTrigger><SelectValue placeholder="Ciclo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSAL">Mensal</SelectItem>
                  <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
                  <SelectItem value="ANUAL">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input type="date" value={form.proximo_vencimento} onChange={(e) => setForm((s) => ({ ...s, proximo_vencimento: e.target.value }))} />
          </div>

          <DialogFooter className="gap-2">
            {editing ? (
              <Button variant="destructive" onClick={deleteAssinante} disabled={saving}>Excluir</Button>
            ) : null}
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveAssinante} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
