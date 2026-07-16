import { Home, Users, QrCode, Mail, FileSpreadsheet, LogOut, Globe, FileDown, Workflow, BarChart2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useRef } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { AceBrand } from "@/components/AceBrand";

const mainMenuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Invites", url: "/customers", icon: Users },
  { title: "Check-In", url: "/check-in", icon: QrCode },
  { title: "Invitations", url: "/invitations", icon: Mail },
  { title: "Import", url: "/import", icon: FileSpreadsheet },
  { title: "Public Pages", url: "/public-pages", icon: Globe },
  { title: "Export", url: "/export", icon: FileDown },
  { title: "Sign-in Flow", url: "/sign-in-flow", icon: Workflow },
  { title: "Analytics", url: "/analytics", icon: BarChart2 },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const { setOpen, state } = useSidebar();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const collapsed = state === "collapsed";

  const handleMouseEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:px-2">
        <AceBrand
          compact={collapsed}
          showProductName={!collapsed}
          className="group-data-[collapsible=icon]:justify-center"
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => logout()} tooltip="Logout" data-testid="button-logout">
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
