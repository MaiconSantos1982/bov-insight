import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider } from "@/lib/data-provider";
import { AppShell } from "@/components/app-shell";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "BovInsight - Inteligência de Mercado Pecuário",
    description: "Plataforma SaaS de inteligência de mercado para pecuaristas. Acompanhe indicadores, relação de troca, sazonalidade e configure alertas pro.",
    keywords: ["pecuária", "boi gordo", "mercado pecuário", "relação de troca"],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <DataProvider>
                    <TooltipProvider>
                        <AppShell>{children}</AppShell>
                    </TooltipProvider>
                </DataProvider>
                <Toaster position="bottom-right" duration={4000} />
            </body>
        </html>
    );
}
