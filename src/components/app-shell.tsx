"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const isPublicStandaloneRoute = pathname === "/login" || pathname === "/lista-espera"
  const [checkingAuth, setCheckingAuth] = useState(!isPublicStandaloneRoute)
  const [authenticated, setAuthenticated] = useState(isPublicStandaloneRoute)

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
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
