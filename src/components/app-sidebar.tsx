"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    ArrowLeftRight,
    CalendarRange,
    Bell,
    Settings,
    TrendingUp,
    LineChart,
    ChevronUp,
    History,
    GitBranch,
    MapPinned,
    Ship,
    BellRing,
    Shield,
    Users,
    MessageSquare,
    FileText,
    Webhook,
    Table2,
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
        label: 'Base Regional',
        href: '/base-regional',
        icon: MapPinned,
    },
    {
        label: 'Exportações',
        href: '/exportacoes',
        icon: Ship,
    },
    {
        label: 'Alertas Analíticos',
        href: '/alertas-analiticos',
        icon: BellRing,
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
]

export function AppSidebar() {
    const pathname = usePathname()
    const { setOpenMobile } = useSidebar()
    const resolvedMenuItems = menuItems

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
                                    <span className="font-semibold text-sm">BovInsight</span>
                                    <span className="text-xs text-muted-foreground">Inteligência Pecuária</span>
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
                                            {item.badge && (
                                                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
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
                            {adminMenuItems.map((item) => (
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
                                    MS
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5 leading-none">
                                <span className="text-sm font-medium">Maicon Santos</span>
                                <span className="text-xs text-muted-foreground">Plano Pro</span>
                            </div>
                            <ChevronUp className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
