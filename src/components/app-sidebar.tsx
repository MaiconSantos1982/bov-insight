"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
    LayoutDashboard,
    ArrowLeftRight,
    CalendarRange,
    Bell,
    Landmark,
    Settings,
    TrendingUp,
    LineChart,
    ChevronUp,
    History,
    GitBranch,
    Ship,
    Newspaper,
    Shield,
    Users,
    MessageSquare,
    FileText,
    Webhook,
    Table2,
    ListChecks,
    LogOut,
    Lock,
} from 'lucide-react'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useData } from '@/lib/data-provider'

const menuItems = [
    {
        label: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
    },
    {
        label: 'Relação de Troca',
        href: '/relacao-troca',
        icon: ArrowLeftRight,
    },
    {
        label: 'Sazonalidade',
        href: '/sazonalidade',
        icon: CalendarRange,
    },
    {
        label: 'Análise de Gráfico',
        href: '/analise-grafico',
        icon: LineChart,
    },
    {
        label: 'Histórico',
        href: '/historico',
        icon: History,
    },
    {
        label: 'Ciclo Pecuário',
        href: '/ciclo-pecuario',
        icon: GitBranch,
    },
    {
        label: 'Cotações',
        href: '/cotacoes',
        icon: Landmark,
    },
    {
        label: 'Mercado Futuro',
        href: '/mercado-futuro',
        icon: TrendingUp,
    },
    {
        label: 'Relatórios',
        href: '/relatorios',
        icon: Newspaper,
        badge: 'DEV',
    },
    {
        label: 'Exportações',
        href: '/exportacoes',
        icon: Ship,
    },
    {
        label: 'Alertas Pro',
        href: '/alertas',
        icon: Bell,
        badge: 'PRO',
    },
]

const adminMenuItems = [
    {
        label: 'Admin Dashboard',
        href: '/admin',
        icon: Shield,
    },
    {
        label: 'Assinantes',
        href: '/admin/assinantes',
        icon: Users,
    },
    {
        label: 'Webhooks',
        href: '/admin/webhooks',
        icon: Webhook,
    },
    {
        label: 'Grupos e Mensagens',
        href: '/admin/grupos-mensagens',
        icon: MessageSquare,
    },
    {
        label: 'Logs de Execução',
        href: '/admin/logs-execucao',
        icon: FileText,
    },
    {
        label: 'CEPEA Widget',
        href: '/admin/cepea-widget',
        icon: Table2,
    },
    {
        label: 'Notícias e Análises',
        href: '/admin/noticias-analises',
        icon: Newspaper,
    },
    {
        label: 'Lista de Espera',
        href: '/admin/lista-espera',
        icon: ListChecks,
    },
]

export function AppSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { setOpenMobile } = useSidebar()
    const { authUser, usuarioConfiguracao, isSuperAdmin } = useData()
    const isFreeUser = authUser?.tier === 'FREE'
    const resolvedMenuItems = menuItems.filter((item) => {
        if ((item.href === '/alertas' || item.href === '/relatorios') && !isSuperAdmin) {
            return false
        }
        return true
    })
    const [loggingOut, setLoggingOut] = useState(false)
    const displayName =
        authUser?.nome?.trim() ||
        usuarioConfiguracao?.nome?.trim() ||
        authUser?.email ||
        'Usuário'
    const planLabel = isSuperAdmin
        ? 'Super Admin'
        : authUser?.tier === 'FREE'
            ? 'Plano Gratuito'
            : 'Plano Assinante'
    const initials = getInitials(displayName)

    async function handleLogout() {
        setLoggingOut(true)
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
        } finally {
            router.push('/login')
            router.refresh()
            setLoggingOut(false)
        }
    }

    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    <TrendingUp className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold text-sm">Inteligência</span>
                                    <span className="text-xs text-muted-foreground">Pecuária</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {resolvedMenuItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.href}
                                        tooltip={item.label}
                                        onClick={() => setOpenMobile(false)}
                                    >
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.label}</span>
                                            {isFreeUser && item.href !== '/cotacoes' && (
                                                <Lock className="ml-auto size-3.5 text-muted-foreground" />
                                            )}
                                            {item.badge && (
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] px-1.5 py-0 bg-primary/10 text-primary ${isFreeUser && item.href !== '/cotacoes' ? 'ml-1' : 'ml-auto'}`}
                                                >
                                                    {item.badge}
                                                </Badge>
                                            )}
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Sistema</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Configurações">
                                    <Link href="/configuracoes">
                                        <Settings />
                                        <span>Configurações</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            {isSuperAdmin && adminMenuItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.href}
                                        tooltip={item.label}
                                        onClick={() => setOpenMobile(false)}
                                    >
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg">
                            <Avatar className="size-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5 leading-none">
                                <span className="text-sm font-medium">{displayName}</span>
                                <span className="text-xs text-muted-foreground">{planLabel}</span>
                            </div>
                            <ChevronUp className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            tooltip="Sair"
                            onClick={handleLogout}
                            disabled={loggingOut}
                        >
                            <LogOut />
                            <span>{loggingOut ? 'Saindo...' : 'Sair'}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}

function getInitials(name: string): string {
    const cleaned = name.trim()
    if (!cleaned) return 'US'
    const parts = cleaned.split(/\s+/).filter(Boolean)
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase()
    }
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}
