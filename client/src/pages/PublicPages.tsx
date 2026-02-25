import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, QrCode, ClipboardList, Save } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PageSettings } from "@shared/schema";

function ScanPageEditor() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/scan_page"],
  });

  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (settings) {
      setEventName(settings.eventName ?? "");
      setEventDate(settings.eventDate ?? "");
      setEventLocation(settings.eventLocation ?? "");
      setTitle(settings.title ?? "Welcome!");
      setDescription(settings.description ?? "Please scan the QR code with your phone to check in");
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/page-settings/scan_page", {
        title,
        description,
        eventName,
        eventDate,
        eventLocation,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-settings/scan_page"] });
      toast({ title: "Saved", description: "QR Code Display page updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const pageUrl = `${window.location.origin}/scan`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            This page is displayed on your reception screen. Guests scan the QR code to check in.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open(pageUrl, "_blank")}
          data-testid="button-open-scan-page"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Page
        </Button>
      </div>

      <div className="bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground font-mono break-all">
        {pageUrl}
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Event Details</h3>

          <div className="space-y-2">
            <Label htmlFor="scan-event-name">Event Name</Label>
            <Input
              id="scan-event-name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. AUSA Annual Meeting 2025"
              disabled={isLoading}
              data-testid="input-scan-event-name"
            />
            <p className="text-xs text-muted-foreground">Displayed prominently on the scan page</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-event-date">Event Date</Label>
            <Input
              id="scan-event-date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              placeholder="e.g. October 15, 2025"
              disabled={isLoading}
              data-testid="input-scan-event-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-event-location">Event Location</Label>
            <Input
              id="scan-event-location"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              placeholder="e.g. Washington D.C."
              disabled={isLoading}
              data-testid="input-scan-event-location"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Page Content</h3>

          <div className="space-y-2">
            <Label htmlFor="scan-title">Welcome Title</Label>
            <Input
              id="scan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Welcome!"
              disabled={isLoading}
              data-testid="input-scan-title"
            />
            <p className="text-xs text-muted-foreground">Large heading shown above the QR code</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-description">Scan Instruction</Label>
            <Textarea
              id="scan-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Please scan the QR code with your phone to check in"
              rows={3}
              disabled={isLoading}
              data-testid="input-scan-description"
            />
            <p className="text-xs text-muted-foreground">Instruction text shown below the title</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isLoading || !title.trim() || !description.trim()}
          data-testid="button-save-scan-page"
        >
          <Save className="mr-2 h-4 w-4" />
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function GuestCheckInEditor() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/guest_checkin_page"],
  });

  const [eventName, setEventName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [successTitle, setSuccessTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (settings) {
      setEventName(settings.eventName ?? "");
      setTitle(settings.title ?? "Check-In");
      setDescription(settings.description ?? "Enter your phone number or email address to check in");
      setSuccessTitle(settings.successTitle ?? "Welcome!");
      setSuccessMessage(settings.successMessage ?? "You have been successfully checked in");
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/page-settings/guest_checkin_page", {
        title,
        description,
        eventName,
        successTitle,
        successMessage,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/page-settings/guest_checkin_page"] });
      toast({ title: "Saved", description: "Guest Check-In Form updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const pageUrl = `${window.location.origin}/guest-check-in`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            This is the form guests see on their phone after scanning the QR code.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open(pageUrl, "_blank")}
          data-testid="button-open-guest-page"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Page
        </Button>
      </div>

      <div className="bg-muted rounded-md px-3 py-2 text-xs text-muted-foreground font-mono break-all">
        {pageUrl}
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Form Content</h3>

          <div className="space-y-2">
            <Label htmlFor="guest-event-name">Event Name</Label>
            <Input
              id="guest-event-name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. AUSA Annual Meeting 2025"
              disabled={isLoading}
              data-testid="input-guest-event-name"
            />
            <p className="text-xs text-muted-foreground">Shown below the logo on the check-in form</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest-title">Form Title</Label>
            <Input
              id="guest-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Check-In"
              disabled={isLoading}
              data-testid="input-guest-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest-description">Form Description</Label>
            <Textarea
              id="guest-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Enter your phone number or email address to check in"
              rows={3}
              disabled={isLoading}
              data-testid="input-guest-description"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Success Screen</h3>
          <p className="text-xs text-muted-foreground">Shown after a guest successfully checks in</p>

          <div className="space-y-2">
            <Label htmlFor="guest-success-title">Success Title</Label>
            <Input
              id="guest-success-title"
              value={successTitle}
              onChange={(e) => setSuccessTitle(e.target.value)}
              placeholder="e.g. Welcome!"
              disabled={isLoading}
              data-testid="input-guest-success-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest-success-message">Success Message</Label>
            <Input
              id="guest-success-message"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              placeholder="e.g. You have been successfully checked in"
              disabled={isLoading}
              data-testid="input-guest-success-message"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isLoading || !title.trim() || !description.trim()}
          data-testid="button-save-guest-page"
        >
          <Save className="mr-2 h-4 w-4" />
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

export default function PublicPages() {
  return (
    <div className="space-y-6" data-testid="page-public-pages">
      <div>
        <h1 className="text-3xl font-bold">Public Pages</h1>
        <p className="text-muted-foreground">Customize the pages your guests see at the event</p>
      </div>

      <Tabs defaultValue="scan">
        <TabsList>
          <TabsTrigger value="scan" data-testid="tab-scan-page">
            <QrCode className="mr-2 h-4 w-4" />
            QR Code Display
          </TabsTrigger>
          <TabsTrigger value="guest" data-testid="tab-guest-page">
            <ClipboardList className="mr-2 h-4 w-4" />
            Guest Check-In Form
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>QR Code Display Page</CardTitle>
              <CardDescription>
                Shown on your reception screen — guests scan this to check in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScanPageEditor />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guest" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Guest Check-In Form</CardTitle>
              <CardDescription>
                The form guests fill in on their phone after scanning the QR code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GuestCheckInEditor />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
