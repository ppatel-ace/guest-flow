import { Home, Users, QrCode, Mail, FileSpreadsheet, LogOut, Globe, FileDown, Workflow, BarChart2, Pin, PinOff } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { AceAppVersionFooter } from "@/components/AceAppVersionFooter";

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
  const [pinned, setPinned] = useState(false);

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
    // While pinned the sidebar stays open — no auto-collapse.
    if (pinned) return;
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
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <AceBrand
            compact={collapsed}
            className="min-w-0"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 group-data-[collapsible=icon]:hidden"
            onClick={() => setPinned((p) => !p)}
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            aria-pressed={pinned}
            data-testid="button-sidebar-pin"
          >
            {pinned ? (
              <Pin className="h-4 w-4 text-primary" />
            ) : (
              <PinOff className="h-4 w-4" />
            )}
          </Button>
        </div>
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
        <div
          className="px-3 pb-3 pt-1 text-[11px] text-muted-foreground group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:text-center"
          data-testid="sidebar-app-version"
        >
          <AceAppVersionFooter
            appSlug="guestflow"
            displayName="GuestFlow"
            fallbackVersion="1.1.1"
            className="group-data-[collapsible=icon]:hidden"
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
