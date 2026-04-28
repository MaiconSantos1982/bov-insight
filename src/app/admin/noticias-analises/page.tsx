"use client"

import { useEffect, useRef, useState } from "react"
import { Newspaper, ShieldAlert } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { AdminSubnav } from "@/components/admin-subnav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/lib/data-provider"

const WIDGET_URL =
  "https://www.noticiasagricolas.com.br/widgets/noticias?subsecao=8,64,13,97,14,205,15,212,149,26,148,154,105,107,116,117,118,120&largura=300px&altura=250px&fonte=Arial%2C%20Helvetica%2C%20sans-serif&tamanho=10pt&cortexto=333333&corlink=006666&qtd=15&output=js"

function mountWidgetInIframe(iframe: HTMLIFrameElement) {
  const doc = iframe.contentDocument
  if (!doc) return

  doc.open()
  doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 12px;
        background: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
      }
      a { text-decoration: none; }
      table { width: 100% !important; }
    </style>
  </head>
  <body>
    <script src="${WIDGET_URL}"></script>
  </body>
</html>`)
  doc.close()
}

export default function AdminNoticiasAnalisesPage() {
  const { isSuperAdmin } = useData()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [loadedAt, setLoadedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperAdmin) return
    const iframe = iframeRef.current
    if (!iframe) return

    mountWidgetInIframe(iframe)
    setLoadedAt(new Date().toLocaleString("pt-BR"))
  }, [isSuperAdmin])

  if (!isSuperAdmin) {
    return (
      <>
        <PageHeader
          title="Admin · Notícias e Análises"
          description="Conteúdo restrito para super admin"
          showDatePicker={false}
        >
          <AdminSubnav />
        </PageHeader>

        <div className="p-4 sm:p-6">
          <Card>
            <CardContent className="flex items-center gap-3 py-8">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Acesso restrito. Esta página é visível apenas para super admin.
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Admin · Notícias e Análises"
        description="Feed de notícias do Notícias Agrícolas para acompanhamento interno"
        showDatePicker={false}
      >
        <AdminSubnav />
      </PageHeader>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Feed de Notícias</CardTitle>
              </div>
              <Badge variant="secondary">Super Admin</Badge>
            </div>
            <CardDescription>
              Fonte: Notícias Agrícolas widget (subseções selecionadas).
              {loadedAt ? ` Última carga: ${loadedAt}.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/60 bg-background">
              <iframe
                ref={iframeRef}
                title="Notícias e Análises"
                className="h-[760px] w-full rounded-lg"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
