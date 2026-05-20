import { Home, Users, QrCode, Mail, FileSpreadsheet, LogOut, Globe, FileDown, Workflow, BarChart2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const mainMenuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Invites", url: "/customers", icon: Users },
  { title: "Check-In", url: "/check-in", icon: QrCode },
  { title: "Invitations", url: "/invitations", icon: Mail },
  { title: "Import", url: "/import", icon: FileSpreadsheet },
  { title: "Public Pages", url: "/public-pages", icon: Globe },
  { title: "Export", url: "/export", icon: FileDown },
  { title: "Sign-in Flow", url: "/sign-in-flow", icon: Workflow },
  { title: "Envoy Analytics", url: "/envoy-analytics", icon: BarChart2 },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Customer Check-In</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
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
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => logout()} data-testid="button-logout">
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
