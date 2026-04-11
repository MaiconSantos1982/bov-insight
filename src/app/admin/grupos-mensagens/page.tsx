"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronDown, Plus, Pencil, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AdminSubnav } from "@/components/admin-subnav"
import { useData } from "@/lib/data-provider"
import { formatPhoneForDisplay } from "@/lib/phone-format"
import { supabase, type GrupoNotificacao } from "@/lib/supabase"
import { toast } from "sonner"

const ALERT_TYPE_OPTIONS = ["CICLO_PECUARIO", "BASE_REGIONAL", "ESCALA_ABATE", "EXPORTACAO"]
const SEVERIDADE_OPTIONS = ["ALTA", "MEDIA", "BAIXA"]

type GroupFormState = {
  id?: string
  nome_grupo: string
  group_id: string
  tipos_alerta: string[]
  severidades: string[]
  ativo: boolean
}

function emptyForm(): GroupFormState {
  return {
    nome_grupo: "",
    group_id: "",
    tipos_alerta: [],
    severidades: [],
    ativo: true,
  }
}

function toggleValue(arr: string[], v: string): string[] {
  if (arr.includes(v)) return arr.filter((item) => item !== v)
  return [...arr, v]
}

export default function AdminGruposMensagensPage() {
  const { gruposNotificacao, alertasProEnvios } = useData()
  const [groups, setGroups] = useState<GrupoNotificacao[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [disparandoManual, setDisparandoManual] = useState(false)
  const [form, setForm] = useState<GroupFormState>(emptyForm())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<GrupoNotificacao | null>(null)

  useEffect(() => {
    setGroups(gruposNotificacao)
  }, [gruposNotificacao])

  const enviados = alertasProEnvios.filter((item) => item.status === "ENVIADO").length
  const falhas = alertasProEnvios.filter((item) => item.status === "FALHA").length
  const custoTotal = alertasProEnvios.reduce((sum, item) => sum + (item.custo_estimado_brl || 0), 0)

  function openNewDialog() {
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEditDialog(group: GrupoNotificacao) {
    setForm({
      id: group.id,
      nome_grupo: group.nome_grupo || "",
      group_id: group.group_id,
      tipos_alerta: group.tipos_alerta || [],
      severidades: group.severidades || [],
      ativo: group.ativo,
    })
    setDialogOpen(true)
  }

  async function handleToggleAtivo(group: GrupoNotificacao, value: boolean) {
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, ativo: value } : g)))
    const { error } = await supabase.from("boigordo_grupos_notificacao").update({ ativo: value }).eq("id", group.id)
    if (error) {
      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, ativo: group.ativo } : g)))
      toast.error("Falha ao atualizar status", { description: error.message })
      return
    }
    toast.success("Status atualizado")
  }

  async function handleSaveGroup() {
    const nextGroupId = form.group_id.trim()
    if (!nextGroupId) {
      toast.error("ID do grupo obrigatório")
      return
    }
    setSaving(true)
    try {
      const duplicated = groups.find(
        (g) => g.group_id.trim().toLowerCase() === nextGroupId.toLowerCase() && g.id !== form.id
      )
      if (duplicated) {
        toast.error("ID do grupo já em uso", {
          description: `Este ID já está cadastrado no grupo "${duplicated.nome_grupo || duplicated.group_id}".`,
        })
        return
      }

      if (form.id) {
        const { data, error } = await supabase
          .from("boigordo_grupos_notificacao")
          .update({
            nome_grupo: form.nome_grupo || null,
            group_id: nextGroupId,
            tipos_alerta: form.tipos_alerta,
            severidades: form.severidades,
            ativo: form.ativo,
          })
          .eq("id", form.id)
          .select("*")
          .single()
        if (error) throw error
        setGroups((prev) => prev.map((g) => (g.id === form.id ? (data as GrupoNotificacao) : g)))
        toast.success("Grupo atualizado")
      } else {
        const { data, error } = await supabase
          .from("boigordo_grupos_notificacao")
          .insert({
            nome_grupo: form.nome_grupo || null,
            group_id: nextGroupId,
            tipos_alerta: form.tipos_alerta,
            severidades: form.severidades,
            ativo: form.ativo,
          })
          .select("*")
          .single()
        if (error) throw error
        setGroups((prev) => [data as GrupoNotificacao, ...prev])
        toast.success("Grupo criado")
      }
      setDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isConflict = message.includes("409") || message.toLowerCase().includes("duplicate")
      toast.error("Falha ao salvar grupo", {
        description: isConflict
          ? "Conflito de ID: já existe outro grupo com este mesmo group_id."
          : message,
      })
    } finally {
      setSaving(false)
    }
  }

  function openDeleteDialog(group: GrupoNotificacao) {
    setGroupToDelete(group)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteGroup() {
    if (!groupToDelete) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from("boigordo_grupos_notificacao")
        .delete()
        .eq("id", groupToDelete.id)
      if (error) throw error
      setGroups((prev) => prev.filter((g) => g.id !== groupToDelete.id))
      toast.success("Grupo excluído")
      setDeleteDialogOpen(false)
      setGroupToDelete(null)
    } catch (error) {
      toast.error("Falha ao excluir grupo", { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDisparoManualTeste() {
    setDisparandoManual(true)
    try {
      const response = await fetch("/api/admin/disparo-manual", { method: "POST" })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Falha no disparo manual.")
      }
      toast.success("Disparo manual iniciado", {
        description: "Confira os logs do grupos-server e o WhatsApp de destino.",
      })
    } catch (error) {
      toast.error("Falha no disparo manual", {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setDisparandoManual(false)
    }
  }

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => Number(b.ativo) - Number(a.ativo)), [groups])

  return (
    <>
      <PageHeader title="Admin · Grupos e Mensagens" description="Gestão de roteamento e custos de envios" showDatePicker={false}>
        <AdminSubnav />
      </PageHeader>
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Enviados</p><p className="text-2xl font-bold mt-1">{enviados}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Falhas</p><p className="text-2xl font-bold mt-1">{falhas}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Custo total</p><p className="text-2xl font-bold mt-1">R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Grupos de Notificação</CardTitle>
                <CardDescription>Tipos e severidades por grupo</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleDisparoManualTeste} disabled={disparandoManual}>
                  {disparandoManual ? "Disparando..." : "Teste Disparo Manual"}
                </Button>
                <Button size="sm" className="gap-2" onClick={openNewDialog}>
                  <Plus className="size-4" />
                  Novo Grupo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedGroups.map((group) => (
              <div key={group.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-sm">{group.nome_grupo || "Grupo sem nome"}</p>
                  <div className="flex items-center gap-2">
                    <Switch checked={group.ativo} onCheckedChange={(v) => handleToggleAtivo(group, v)} />
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditDialog(group)}>
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(group)}>
                      <Trash2 className="size-3.5" />
                      Excluir
                    </Button>
                    <Badge variant={group.ativo ? "default" : "outline"}>{group.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground break-all mt-1">{group.group_id}</p>
                <p className="text-xs mt-1">Tipos: {group.tipos_alerta?.length ? group.tipos_alerta.join(", ") : "Todos"}</p>
                <p className="text-xs">Severidades: {group.severidades?.length ? group.severidades.join(", ") : "Todas"}</p>
              </div>
            ))}
            {sortedGroups.length === 0 && <p className="text-sm text-muted-foreground">Sem grupos cadastrados.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimos Envios Pro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Quando</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Usuário</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Destino</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Custo</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {alertasProEnvios.slice(0, 80).map((item) => (
                    <tr key={item.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2.5 px-3">{format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                      <td className="py-2.5 px-3">{item.usuario_id}</td>
                      <td className="py-2.5 px-3">{formatPhoneForDisplay(item.telefone_destino)}</td>
                      <td className="py-2.5 px-3">R$ {item.custo_estimado_brl.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}</td>
                      <td className="text-right py-2.5 px-3"><Badge variant={item.status === "ENVIADO" ? "default" : "secondary"}>{item.status}</Badge></td>
                    </tr>
                  ))}
                  {alertasProEnvios.length === 0 && (
                    <tr><td colSpan={5} className="py-8 px-3 text-center text-muted-foreground">Sem envios registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
            <DialogDescription>Configure ID, tipos de mensagem e severidades.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
              <Input value={form.nome_grupo} onChange={(e) => setForm((prev) => ({ ...prev, nome_grupo: e.target.value }))} placeholder="Ex: Grupo Critico" />
            </div>
            <div className="space-y-2">
              <Label>ID do grupo</Label>
              <Input value={form.group_id} onChange={(e) => setForm((prev) => ({ ...prev, group_id: e.target.value }))} placeholder="1203...@g.us" />
            </div>
            <div className="space-y-2">
              <Label>Tipos de mensagem</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {form.tipos_alerta.length ? `${form.tipos_alerta.length} selecionado(s)` : "Todos os tipos"}
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  {ALERT_TYPE_OPTIONS.map((item) => (
                    <DropdownMenuCheckboxItem
                      key={item}
                      checked={form.tipos_alerta.includes(item)}
                      onCheckedChange={() => setForm((prev) => ({ ...prev, tipos_alerta: toggleValue(prev.tipos_alerta, item) }))}
                    >
                      {item}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-2">
              <Label>Severidades</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {form.severidades.length ? `${form.severidades.length} selecionada(s)` : "Todas severidades"}
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  {SEVERIDADE_OPTIONS.map((item) => (
                    <DropdownMenuCheckboxItem
                      key={item}
                      checked={form.severidades.includes(item)}
                      onCheckedChange={() => setForm((prev) => ({ ...prev, severidades: toggleValue(prev.severidades, item) }))}
                    >
                      {item}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Grupo ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((prev) => ({ ...prev, ativo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveGroup} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Deseja excluir o grupo <strong>{groupToDelete?.nome_grupo || groupToDelete?.group_id}</strong>?
              Esta ação remove a configuração de roteamento deste grupo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup} disabled={saving}>
              {saving ? "Excluindo..." : "Excluir Grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
