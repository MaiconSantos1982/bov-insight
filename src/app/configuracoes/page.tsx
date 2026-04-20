"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CreditCard, Phone, Save, ShieldCheck, UserRound, ChevronDown } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useData } from "@/lib/data-provider"
import { toast } from "sonner"

const PAPEL_OPTIONS = [
  "Criador",
  "Vendedor",
  "Comprador",
  "Recria",
  "Engorda",
  "Confinamento",
]

const ETAPA_OPTIONS = [
  "Cria",
  "Recria",
  "Engorda",
  "Ciclo Completo",
]

const CABECAS_OPTIONS = [
  { value: "sem_criacao", label: "Nao tenho criacao", numeric: 0 },
  { value: "0_100", label: "0 a 100", numeric: 100 },
  { value: "101_300", label: "101 a 300", numeric: 300 },
  { value: "301_500", label: "301 a 500", numeric: 500 },
  { value: "501_1000", label: "501 a 1.000", numeric: 1000 },
  { value: "1000_5000", label: "1.000 a 5.000", numeric: 5000 },
  { value: "5000_10000", label: "5.000 a 10.000", numeric: 10000 },
]

function formatCiclo(value: string | null): string {
  if (value === "MENSAL") return "Mensal"
  if (value === "TRIMESTRAL") return "Trimestral"
  if (value === "ANUAL") return "Anual"
  return "Nao definido"
}

function formatStatus(value: string | null): string {
  if (value === "ATIVA") return "Ativa"
  if (value === "TRIAL") return "Trial"
  if (value === "INADIMPLENTE") return "Inadimplente"
  if (value === "CANCELADA") return "Cancelada"
  if (value === "EXPIRADA") return "Expirada"
  return "Nao definido"
}

function formatPagamentoStatus(value: string): string {
  if (value === "PAGO") return "Pago"
  if (value === "PENDENTE") return "Pendente"
  if (value === "FALHOU") return "Falhou"
  if (value === "ESTORNADO") return "Estornado"
  return value
}

function formatPhoneBr(value: string): string {
  const digits = value.replace(/\D/g, "")
  const local = digits.startsWith("55") ? digits.slice(2) : digits
  if (local.length < 10) return value
  const ddd = local.slice(0, 2)
  const prefix = local.length > 10 ? local.slice(2, 7) : local.slice(2, 6)
  const suffix = local.length > 10 ? local.slice(7, 11) : local.slice(6, 10)
  return `(${ddd}) ${prefix}.${suffix}`
}

function cabecasToOption(value: number | null): string {
  if (value == null) return "sem_criacao"
  const found = CABECAS_OPTIONS.find((opt) => value <= opt.numeric)
  return found?.value || "5000_10000"
}

function optionToCabecas(value: string): number {
  const found = CABECAS_OPTIONS.find((opt) => opt.value === value)
  return found?.numeric || 0
}

export default function ConfiguracoesPage() {
  const { usuarioConfiguracao, assinaturasProximoVencimento, alertasProDestinos, alertasProRegras, pagamentosHistorico } = useData()

  const canEditPersonalData = process.env.NEXT_PUBLIC_CONFIG_ALLOW_ADMIN_EDIT === "true"

  const [usuarioIdFallback, setUsuarioIdFallback] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = window.localStorage.getItem("bovinsight_usuario_id")
    if (saved) setUsuarioIdFallback(saved)
  }, [])

  const usuarioId = usuarioConfiguracao?.usuario_id || usuarioIdFallback || null

  const assinaturaAtual = useMemo(() => {
    if (!usuarioId) return null
    return assinaturasProximoVencimento.find((item) => item.usuario_id === usuarioId) || null
  }, [assinaturasProximoVencimento, usuarioId])

  const destinoAtivo = useMemo(
    () => alertasProDestinos.find((d) => d.ativo && (!usuarioId || d.usuario_id === usuarioId)) || null,
    [alertasProDestinos, usuarioId]
  )

  const regrasUsuario = useMemo(
    () => alertasProRegras.filter((item) => (usuarioId ? item.usuario_id === usuarioId : true)),
    [alertasProRegras, usuarioId]
  )
  const pagamentosUsuario = useMemo(
    () => pagamentosHistorico.filter((item) => (usuarioId ? item.usuario_id === usuarioId : true)),
    [pagamentosHistorico, usuarioId]
  )
  const pagamentoMaisRecente = pagamentosUsuario[0] || null

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState("")
  const [papeisMercado, setPapeisMercado] = useState<string[]>([])
  const [etapasOperacao, setEtapasOperacao] = useState<string[]>([])
  const [cabecasFaixa, setCabecasFaixa] = useState("sem_criacao")
  const [experienciaAnos, setExperienciaAnos] = useState("")
  const [telefoneDestino, setTelefoneDestino] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setNome(usuarioConfiguracao?.nome || "")
    setEmail(usuarioConfiguracao?.email || "")
    setTelefoneWhatsapp(usuarioConfiguracao?.telefone_whatsapp || "")
    setPapeisMercado(usuarioConfiguracao?.papeis_mercado || [])
    setEtapasOperacao(usuarioConfiguracao?.etapas_operacao || [])
    setCabecasFaixa(cabecasToOption(usuarioConfiguracao?.cabecas_gado ?? null))
    setExperienciaAnos(usuarioConfiguracao?.experiencia_anos != null ? String(usuarioConfiguracao.experiencia_anos) : "")
    setTelefoneDestino(destinoAtivo?.telefone_destino || usuarioConfiguracao?.telefone_whatsapp || "")
  }, [usuarioConfiguracao, destinoAtivo])

  function toggleArrayValue(current: string[], value: string): string[] {
    if (current.includes(value)) return current.filter((item) => item !== value)
    return [...current, value]
  }

  async function handleSalvarConfiguracoes() {
    if (!nome || !telefoneWhatsapp) {
      toast.error("Campos obrigatorios", { description: "Nome e telefone WhatsApp sao obrigatorios." })
      return
    }

    setSalvando(true)
    try {
      const resolvedUsuarioId = usuarioId || (typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`)
      if (!usuarioId && typeof window !== "undefined") {
        window.localStorage.setItem("bovinsight_usuario_id", resolvedUsuarioId)
        setUsuarioIdFallback(resolvedUsuarioId)
      }

      const nomeFinal = nome
      const emailFinal = canEditPersonalData ? (email || null) : (usuarioConfiguracao?.email || null)
      const telefoneFinal = telefoneWhatsapp

      const response = await fetch("/api/configuracoes/salvar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: resolvedUsuarioId,
          nome: nomeFinal,
          email: emailFinal,
          telefone_whatsapp: telefoneFinal,
          papeis_mercado: papeisMercado,
          etapas_operacao: etapasOperacao,
          cabecas_gado: optionToCabecas(cabecasFaixa),
          experiencia_anos: experienciaAnos ? Number(experienciaAnos) : null,
          status: usuarioConfiguracao?.perfil_status || "ATIVO",
          destino_id: destinoAtivo?.id || null,
          telefone_destino: telefoneDestino || telefoneFinal,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Falha ao salvar configurações.")
      }

      toast.success("Configuracoes salvas", { description: "Dados atualizados no Supabase com sucesso." })
      if (typeof window !== "undefined") {
        window.setTimeout(() => window.location.reload(), 300)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error("Falha ao salvar", { description: message })
    } finally {
      setSalvando(false)
    }
  }

  const cabecasLabel = CABECAS_OPTIONS.find((item) => item.value === cabecasFaixa)?.label || "Selecionar faixa"

  return (
    <>
      <PageHeader
        title="Configuracoes"
        description="Dados pessoais, perfil de mercado, assinatura e destino de Alertas Pro"
        showDatePicker={false}
      >
        <Button size="sm" className="gap-2" onClick={handleSalvarConfiguracoes} disabled={salvando}>
          <Save className="size-4" />
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Plano</p>
            <p className="text-2xl font-bold mt-1">{usuarioConfiguracao?.plano || "PRO"}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Status Assinatura</p>
            <p className="text-2xl font-bold mt-1">{formatStatus(usuarioConfiguracao?.assinatura_status || assinaturaAtual?.status || null)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Proximo Vencimento</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">
              {assinaturaAtual?.proximo_vencimento
                ? format(new Date(`${assinaturaAtual.proximo_vencimento}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })
                : "N/D"}
            </p>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><UserRound className="size-4" />Dados Pessoais</CardTitle>
            <CardDescription>
              Dados vindos da compra e sincronizados com a tabela de usuarios.
              {!canEditPersonalData ? " Edicao liberada apenas para admin." : " Edicao habilitada para admin."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} readOnly={!canEditPersonalData} /></div>
            <div className="space-y-2"><Label>Telefone WhatsApp</Label><Input value={formatPhoneBr(telefoneWhatsapp)} onChange={(e) => setTelefoneWhatsapp(e.target.value)} /></div>
            <div className="space-y-2"><Label>Status Perfil</Label><Input value={usuarioConfiguracao?.perfil_status || "ATIVO"} readOnly /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="size-4" />Perfil de Mercado</CardTitle>
            <CardDescription>Questionario base para personalizacao dos alertas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Papeis</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {papeisMercado.length ? `${papeisMercado.length} selecionado(s)` : "Selecionar papeis"}
                      <ChevronDown className="size-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                    {PAPEL_OPTIONS.map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item}
                        checked={papeisMercado.includes(item)}
                        onCheckedChange={() => setPapeisMercado((prev) => toggleArrayValue(prev, item))}
                      >
                        {item}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex flex-wrap gap-2">
                  {papeisMercado.length === 0 ? (
                    <Badge variant="outline">Sem papeis cadastrados</Badge>
                  ) : (
                    papeisMercado.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Etapas</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {etapasOperacao.length ? `${etapasOperacao.length} selecionada(s)` : "Selecionar etapas"}
                      <ChevronDown className="size-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                    {ETAPA_OPTIONS.map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item}
                        checked={etapasOperacao.includes(item)}
                        onCheckedChange={() => setEtapasOperacao((prev) => toggleArrayValue(prev, item))}
                      >
                        {item}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex flex-wrap gap-2">
                  {etapasOperacao.length === 0 ? (
                    <Badge variant="outline">Sem etapas cadastradas</Badge>
                  ) : (
                    etapasOperacao.map((item) => <Badge key={item} variant="outline">{item}</Badge>)
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cabecas de gado</Label>
                <Select value={cabecasFaixa} onValueChange={setCabecasFaixa}>
                  <SelectTrigger><SelectValue placeholder="Selecionar faixa" /></SelectTrigger>
                  <SelectContent>
                    {CABECAS_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{cabecasLabel}</p>
              </div>
              <div className="space-y-2">
                <Label>Experiencia (anos) - opcional</Label>
                <Input value={experienciaAnos} onChange={(e) => setExperienciaAnos(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><CreditCard className="size-4" />Pagamento de Assinatura</CardTitle>
              <CardDescription>Renovacao automatica e regras de cobranca sao geridas na plataforma de pagamentos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Plano:</span> {usuarioConfiguracao?.plano || assinaturaAtual?.plano || "PRO"}</p>
              <p><span className="text-muted-foreground">Ciclo:</span> {formatCiclo(usuarioConfiguracao?.ciclo || assinaturaAtual?.ciclo || null)}</p>
              <p><span className="text-muted-foreground">Metodo:</span> {usuarioConfiguracao?.metodo_pagamento_mask || "N/D"}</p>
              <p><span className="text-muted-foreground">Ultimo pagamento:</span> {pagamentoMaisRecente?.pago_em ? format(new Date(pagamentoMaisRecente.pago_em), "dd/MM/yyyy", { locale: ptBR }) : "N/D"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Phone className="size-4" />Destino Alerta Pro</CardTitle>
              <CardDescription>Telefone destino inicia com o telefone do cadastro e pode ser alterado pelo usuario.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="space-y-2">
                <Label>Telefone destino</Label>
                <Input value={formatPhoneBr(telefoneDestino)} onChange={(e) => setTelefoneDestino(e.target.value)} />
              </div>
              <p><span className="text-muted-foreground">Frequencia:</span> {destinoAtivo?.frequencia || "IMEDIATO"}</p>
              <p><span className="text-muted-foreground">Timezone:</span> {destinoAtivo?.timezone || "America/Sao_Paulo"}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Painel Administrativo do Usuario</CardTitle>
            <CardDescription>Resumo operacional da conta para suporte e acompanhamento</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Usuario ID</p><p className="text-sm font-medium break-all">{usuarioId || "N/D"}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Alertas ativos</p><p className="text-xl font-bold">{regrasUsuario.filter((r) => r.ativo).length}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Destinos ativos</p><p className="text-xl font-bold">{alertasProDestinos.filter((d) => d.ativo && (!usuarioId || d.usuario_id === usuarioId)).length}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Ultimo status pagamento</p><p className="text-sm font-medium">{pagamentoMaisRecente ? formatPagamentoStatus(pagamentoMaisRecente.status) : "N/D"}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historico de Pagamentos</CardTitle>
            <CardDescription>Controle de ciclo, vencimentos e ocorrencias de cobranca</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Competencia</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Valor</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Metodo</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Pago em</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentosUsuario.map((item) => (
                    <tr key={item.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2.5 px-3">{format(new Date(`${item.competencia}T12:00:00`), "MM/yyyy", { locale: ptBR })}</td>
                      <td className="py-2.5 px-3">{item.moeda} {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3">{item.metodo_pagamento || "N/D"}</td>
                      <td className="py-2.5 px-3">{item.pago_em ? format(new Date(item.pago_em), "dd/MM/yyyy", { locale: ptBR }) : "N/D"}</td>
                      <td className="text-right py-2.5 px-3">
                        <Badge variant={item.status === "PAGO" ? "default" : item.status === "PENDENTE" ? "secondary" : "outline"}>
                          {formatPagamentoStatus(item.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {pagamentosUsuario.length === 0 && (
                    <tr><td colSpan={5} className="py-8 px-3 text-center text-muted-foreground">Nenhum pagamento encontrado para este usuario.</td></tr>
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
