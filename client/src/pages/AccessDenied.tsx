import { ShieldX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const HUB_URL = "https://hub.aceelectronics.com";

export default function AccessDeniedPage() {
  const params = new URLSearchParams(window.location.search);
  const message =
    params.get("message") ||
    "You do not have access to this application. Contact your administrator.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldX className="h-6 w-6" />
          </div>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href={HUB_URL}>Return to ACE Hub</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
