import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AceBrand } from "@/components/AceBrand";
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

function AdminLayout() {
  const { logout } = useAuth();

  const style = {
    "--sidebar-width": "17.5rem",
    "--sidebar-width-icon": "3.25rem",
  };

  return (
    <ProtectedRoute>
      <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
        <div className="flex h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between gap-4 border-b border-border/80 bg-background/80 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
              <div className="flex items-center gap-3 min-w-0">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="hidden sm:block h-5 w-px bg-border shrink-0" aria-hidden />
                <AceBrand showProductName className="min-w-0" />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
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
            <main className="flex-1 overflow-auto p-6 md:p-8">
              <div className="mx-auto max-w-7xl">
                <Switch>
                  <Route path="/" component={Dashboard} />
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
              </div>
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
          <Route path="/ace-admin" component={Login} />
          <Route path="/dashboard" component={Login} />
          <Route path="/scan" component={StandaloneCheckIn} />
          <Route path="/guest-check-in" component={GuestCheckIn} />
          <Route path="/kiosk" component={Kiosk} />
          <Route path="/" component={AdminLayout} />
          <Route component={AdminLayout} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
