import Link from "next/link"
import { ArrowRightLeft, ShoppingCart, Tag } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function CalculadoraCompraVendaHomePage() {
  return (
    <>
      <PageHeader
        title="Calculadora de Compra e Venda"
        description="Selecione a operação desejada para simular cenários e apoiar sua decisão."
      />

      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Selecione a operação desejada</CardTitle>
            <CardDescription>Compra ou Venda</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><ShoppingCart className="size-5" />Compra</CardTitle>
                <CardDescription>Simule comprar agora versus esperar um período.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/calculadora-compra-venda/compra">Ir para Compra</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Tag className="size-5" />Venda</CardTitle>
                <CardDescription>Simule vender hoje versus segurar o lote.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/calculadora-compra-venda/venda">Ir para Venda</Link>
                </Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
          <ArrowRightLeft className="size-4" />
          Você pode trocar a operação a qualquer momento por esta tela inicial.
        </div>
      </div>
    </>
  )
}
