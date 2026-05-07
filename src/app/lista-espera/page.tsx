"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ListaEsperaPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/login")
  }, [router])

  return <main className="min-h-screen bg-muted/20" />
}
