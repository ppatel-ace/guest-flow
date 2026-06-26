import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CheckIn from "@/pages/CheckIn";
import Invitations from "@/pages/Invitations";
import Import from "@/pages/Import";
import StandaloneCheckIn from "@/pages/StandaloneCheckIn";
import GuestCheckIn from "@/pages/GuestCheckIn";
import PublicPages from "@/pages/PublicPages";
import Export from "@/pages/Export";
import SignInFlow from "@/pages/SignInFlow";
import EnvoyAnalytics from "@/pages/EnvoyAnalytics";
import Kiosk from "@/pages/Kiosk";
import NotFound from "@/pages/not-found";
import AccessDeniedPage from "@/pages/AccessDenied";

function AdminLayout() {
  const { logout } = useAuth();

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ProtectedRoute>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between p-4 border-b">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logout()}
                  data-testid="button-logout-header"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/customers" component={Customers} />
                <Route path="/check-in" component={CheckIn} />
                <Route path="/invitations" component={Invitations} />
                <Route path="/import" component={Import} />
                <Route path="/public-pages" component={PublicPages} />
                <Route path="/export" component={Export} />
                <Route path="/sign-in-flow" component={SignInFlow} />
                <Route path="/analytics" component={EnvoyAnalytics} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

function App() {
  const isGuestOnlyDomain =
    window.location.hostname === "aceregistration.replit.app";

  if (isGuestOnlyDomain) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/guest-check-in" component={GuestCheckIn} />
            <Route>
              {() => {
                window.location.replace("/guest-check-in");
                return null;
              }}
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/access-denied" component={AccessDeniedPage} />
          <Route path="/ace-admin" component={Login} />
          <Route path="/scan" component={StandaloneCheckIn} />
          <Route path="/guest-check-in" component={GuestCheckIn} />
          <Route path="/kiosk" component={Kiosk} />
          <Route component={AdminLayout} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
