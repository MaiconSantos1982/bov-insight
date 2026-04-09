"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { Bell, BellOff, Plus, Trash2, Send, Clock, Smartphone } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PageHeader } from "@/components/page-header"
import { useData } from "@/lib/data-provider"
import { PRODUTOS, type AlertaProRegra, type ProdutoKey, supabase } from "@/lib/supabase"
import { toast } from "sonner"

function isProdutoKey(value: string): value is ProdutoKey {
  return value in PRODUTOS
}

function buildInitialRules(data: AlertaProRegra[], userId: string | null): AlertaProRegra[] {
  if (!userId) return data
  return data.filter((item) => item.usuario_id === userId)
}

function AlertasPageContent() {
  const { alertasProRegras, alertasProDestinos, usuarioConfiguracao, latestPrices } = useData()
  const searchParams = useSearchParams()
  const auto = searchParams.get("auto") === "1"
  const produtoParam = searchParams.get("produto")
  const condicaoParam = searchParams.get("condicao")
  const valorParam = searchParams.get("valor")
  const initialProduto: ProdutoKey = produtoParam && isProdutoKey(produtoParam) ? produtoParam : "boi_gordo"
  const initialCondicao: "acima_de" | "abaixo_de" = condicaoParam === "abaixo_de" ? "abaixo_de" : "acima_de"
  const initialValor = valorParam && !isNaN(Number(valorParam)) ? Number(valorParam).toFixed(2) : ""

  const userId = useMemo(
    () => usuarioConfiguracao?.usuario_id || alertasProDestinos[0]?.usuario_id || alertasProRegras[0]?.usuario_id || null,
    [usuarioConfiguracao, alertasProDestinos, alertasProRegras]
  )

  const [regras, setRegras] = useState<AlertaProRegra[]>([])
  const [dialogOpen, setDialogOpen] = useState(auto)
  const [newProduto, setNewProduto] = useState<ProdutoKey>(initialProduto)
  const [newCondicao, setNewCondicao] = useState<"acima_de" | "abaixo_de">(initialCondicao)
  const [newValor, setNewValor] = useState(initialValor)
  const [saving, setSaving] = useState(false)

  const destinoAtivo = useMemo(() => alertasProDestinos.find((d) => d.ativo), [alertasProDestinos])

  useEffect(() => {
    setRegras(buildInitialRules(alertasProRegras, userId))
  }, [alertasProRegras, userId])

  const activeCount = regras.filter((a) => a.ativo).length
  const triggeredCount = regras.filter((a) => a.ultimo_disparo).length

  async function handleToggleAlerta(id: string, current: boolean) {
    const next = !current
    setRegras((prev) => prev.map((a) => (a.id === id ? { ...a, ativo: next } : a)))
    const { error } = await supabase.from("boigordo_alertas_pro_regras").update({ ativo: next }).eq("id", id)
    if (error) {
      setRegras((prev) => prev.map((a) => (a.id === id ? { ...a, ativo: current } : a)))
      toast.error("Falha ao atualizar alerta", { description: error.message })
      return
    }
    toast.success(next ? "Alerta ativado" : "Alerta desativado")
  }

  async function handleDeleteAlerta(id: string) {
    const current = regras
    setRegras((prev) => prev.filter((a) => a.id !== id))
    const { error } = await supabase.from("boigordo_alertas_pro_regras").delete().eq("id", id)
    if (error) {
      setRegras(current)
      toast.error("Falha ao remover", { description: error.message })
      return
    }
    toast.success("Alerta removido com sucesso")
  }

  async function handleCreateAlerta() {
    if (!userId) {
      toast.error("Usuário não identificado", { description: "Crie/configure seu perfil em Configurações." })
      return
    }
    if (!newValor || isNaN(Number(newValor))) {
      toast.error("Valor inválido", { description: "Insira um valor numérico válido." })
      return
    }

    setSaving(true)
    const payload = {
      usuario_id: userId,
      produto: newProduto,
      condicao: newCondicao,
      valor_gatilho: Number(newValor),
      ativo: true,
      ultimo_disparo: null,
    }
    const { data, error } = await supabase.from("boigordo_alertas_pro_regras").insert(payload).select("*").single()
    setSaving(false)

    if (error || !data) {
      toast.error("Falha ao criar alerta", { description: error?.message || "Erro desconhecido." })
      return
    }

    setRegras((prev) => [data as AlertaProRegra, ...prev])
    setDialogOpen(false)
    setNewValor("")
    toast.success("Alerta criado")
  }

  function getAlertStatus(alerta: AlertaProRegra) {
    if (!alerta.ativo) return { status: "inactive" as const, label: "Inativo" }
    const currentPrice = latestPrices[alerta.produto]?.valor_brl
    if (currentPrice) {
      const isTriggered = alerta.condicao === "acima_de" ? currentPrice >= alerta.valor_gatilho : currentPrice <= alerta.valor_gatilho
      if (isTriggered) return { status: "triggered" as const, label: "Disparado" }
    }
    return { status: "active" as const, label: "Ativo" }
  }

  return (
    <>
      <PageHeader title="Alertas Pro" description="Configure gatilhos de preço e receba notificações via WhatsApp" showDatePicker={false}>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="size-4" />
              Novo Alerta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Alerta</DialogTitle>
              <DialogDescription>Configure um gatilho de preço para receber notificação via WhatsApp.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="alert-produto">Produto</Label>
                <Select value={newProduto} onValueChange={(v) => setNewProduto(v as ProdutoKey)}>
                  <SelectTrigger id="alert-produto"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRODUTOS).map(([key, val]) => (<SelectItem key={key} value={key}>{val.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-condicao">Condição</Label>
                <Select value={newCondicao} onValueChange={(v) => setNewCondicao(v as "acima_de" | "abaixo_de")}>
                  <SelectTrigger id="alert-condicao"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acima_de">Acima de</SelectItem>
                    <SelectItem value="abaixo_de">Abaixo de</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-valor">Valor Gatilho (R$)</Label>
                <Input id="alert-valor" type="number" step="0.01" value={newValor} onChange={(e) => setNewValor(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateAlerta} disabled={saving} className="gap-2">
                <Bell className="size-4" />
                {saving ? "Criando..." : "Criar Alerta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="card-hover"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Bell className="size-5 text-emerald-500" /></div>
            <div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground">Alertas ativos</p></div>
          </div></CardContent></Card>
          <Card className="card-hover"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Send className="size-5 text-amber-500" /></div>
            <div><p className="text-2xl font-bold">{triggeredCount}</p><p className="text-xs text-muted-foreground">Já disparados</p></div>
          </div></CardContent></Card>
          <Card className="card-hover"><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center"><Smartphone className="size-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">WhatsApp</p>
              <p className="text-xs text-muted-foreground">{destinoAtivo?.telefone_destino || usuarioConfiguracao?.telefone_whatsapp || "Destino não configurado"}</p>
            </div>
          </div></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Seus Alertas</CardTitle><CardDescription>Gerencie seus gatilhos de preço</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {regras.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><BellOff className="size-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum alerta configurado</p></div>
              ) : regras.map((alerta) => {
                const produtoInfo = PRODUTOS[alerta.produto as ProdutoKey]
                const { status, label } = getAlertStatus(alerta)
                const currentPrice = latestPrices[alerta.produto]?.valor_brl
                return (
                  <div key={alerta.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${status === "triggered" ? "bg-emerald-500/5 border-emerald-500/20" : status === "inactive" ? "bg-muted/30 border-border/50 opacity-60" : "bg-card border-border/50 hover:border-border"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{produtoInfo?.label || alerta.produto}</span>
                        <Badge variant={status === "triggered" ? "default" : status === "active" ? "secondary" : "outline"} className={`text-[10px] px-1.5 py-0 ${status === "triggered" ? "bg-emerald-500 text-white" : ""}`}>{label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {alerta.condicao === "acima_de" ? "↑ Acima de" : "↓ Abaixo de"}{" "}
                        <span className="font-semibold text-foreground">R$ {alerta.valor_gatilho.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        <span className="mx-1.5">·</span>Atual: R$ {currentPrice?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || "—"}/{produtoInfo?.unit}
                      </p>
                      {alerta.ultimo_disparo && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="size-3" />Último disparo: {format(new Date(alerta.ultimo_disparo), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={alerta.ativo} onCheckedChange={() => handleToggleAlerta(alerta.id, alerta.ativo)} />
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteAlerta(alerta.id)}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default function AlertasPage() {
  return (
    <Suspense fallback={null}>
      <AlertasPageContent />
    </Suspense>
  )
}
