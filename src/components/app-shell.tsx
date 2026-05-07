"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"

type AppShellProps = {
  children: React.ReactNode
}

type SessionTier = "FREE" | "PRO" | "SUPER_ADMIN"

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const isPublicStandaloneRoute = pathname === "/login" || pathname === "/lista-espera"
  const [checkingAuth, setCheckingAuth] = useState(!isPublicStandaloneRoute)
  const [authenticated, setAuthenticated] = useState(isPublicStandaloneRoute)
  const [sessionTier, setSessionTier] = useState<SessionTier | null>(null)

  const isCotacoesRoute = pathname === "/cotacoes" || pathname.startsWith("/cotacoes/")
  const isFreeLockedRoute = !isPublicStandaloneRoute && authenticated && sessionTier === "FREE" && !isCotacoesRoute

  useEffect(() => {
    if (isPublicStandaloneRoute) {
      setCheckingAuth(false)
      setAuthenticated(true)
      return
    }

    let active = true
    async function validateSession() {
      setCheckingAuth(true)
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" })
        if (!active) return
        if (!res.ok) {
          window.location.href = `/login?next=${encodeURIComponent(pathname)}`
          return
        }
        const payload = (await res.json()) as {
          ok: boolean
          user?: { tier?: SessionTier }
        }
        if (!active) return
        setSessionTier(payload?.user?.tier || null)
        setAuthenticated(true)
      } catch {
        if (active) {
          window.location.href = `/login?next=${encodeURIComponent(pathname)}`
        }
      } finally {
        if (active) setCheckingAuth(false)
      }
    }
    validateSession()
    return () => {
      active = false
    }
  }, [isPublicStandaloneRoute, pathname])

  if (isPublicStandaloneRoute) {
    return <main className="min-h-screen">{children}</main>
  }

  if (checkingAuth || !authenticated) {
    return <main className="min-h-screen" />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="relative min-h-screen">
          <div className={isFreeLockedRoute ? "pointer-events-none select-none blur-[4px]" : ""}>{children}</div>

          {isFreeLockedRoute ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/15 p-4">
              <div className="w-full max-w-lg rounded-xl border bg-background/95 p-6 text-center shadow-xl backdrop-blur">
                <h2 className="text-2xl font-semibold">Área exclusiva para assinantes</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Seu plano gratuito tem acesso apenas à página de Cotações.
                </p>
                <Button asChild className="mt-5">
                  <Link
                    href="https://payfast.greenn.com.br/adesj3f/offer/QwHQe4"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Assinar agora
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
