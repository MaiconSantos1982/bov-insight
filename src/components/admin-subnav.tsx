"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/assinantes", label: "Assinantes" },
  { href: "/admin/grupos-mensagens", label: "Grupos e Mensagens" },
  { href: "/admin/logs-execucao", label: "Logs de Execucao" },
]

export function AdminSubnav() {
  const pathname = usePathname()
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Button key={item.href} asChild variant={pathname === item.href ? "default" : "outline"} size="sm">
          <Link href={item.href}>{item.label}</Link>
        </Button>
      ))}
    </div>
  )
}
