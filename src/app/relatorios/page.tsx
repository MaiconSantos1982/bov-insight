"use client"

import { FileChartColumnIncreasing, Newspaper } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/lib/data-provider"

export default function RelatoriosPage() {
  const { isSuperAdmin } = useData()

  if (!isSuperAdmin) {
    return (
      <>
        <PageHeader
          title="Relatórios"
          description="Acesso restrito para super admin"
          showDatePicker={false}
        />
        <div className="p-4 sm:p-6">
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Central de relatórios estratégicos e notícias"
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Módulo em desenvolvimento</CardTitle>
                <CardDescription>Estrutura inicial pronta para evolução</CardDescription>
              </div>
              <Badge variant="secondary">DEV</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-dashed p-5">
              <p className="text-sm font-medium flex items-center gap-2"><FileChartColumnIncreasing className="size-4 text-primary" /> Relatórios</p>
              <p className="text-sm text-muted-foreground mt-2">
                Área para relatórios de mercado, leitura de tendência, sazonalidade e tomada de decisão.
              </p>
            </div>

            <div className="rounded-lg border border-dashed p-5">
              <p className="text-sm font-medium flex items-center gap-2"><Newspaper className="size-4 text-primary" /> Notícias</p>
              <p className="text-sm text-muted-foreground mt-2">
                Área para notícias e curadoria de eventos que impactam preço, oferta, demanda e exportação.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
