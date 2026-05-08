import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ExternalLink,
  QrCode,
  ClipboardList,
  Save,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PageSettings, FormField } from "@shared/schema";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  tel: "Phone",
  number: "Number",
  select: "Dropdown",
};

const FIXED_FIELDS = [
  { label: "Full Name", type: "text", required: true },
  { label: "Email Address", type: "email", required: true },
  { label: "Phone Number", type: "tel", required: false },
];

interface FieldDialogState {
  open: boolean;
  mode: "add" | "edit";
  field?: FormField;
}

function FieldDialog({
  state,
  onClose,
  onSave,
}: {
  state: FieldDialogState;
  onClose: () => void;
  onSave: (data: Partial<FormField>) => void;
}) {
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [placeholder, setPlaceholder] = useState("");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState("");

  useEffect(() => {
    if (state.open) {
      if (state.mode === "edit" && state.field) {
        setLabel(state.field.label);
        setFieldType(state.field.fieldType);
        setPlaceholder(state.field.placeholder ?? "");
        setRequired(state.field.required);
        if (state.field.options) {
          try {
            const parsed = JSON.parse(state.field.options);
            setOptions(Array.isArray(parsed) ? parsed.join("\n") : "");
          } catch {
            setOptions("");
          }
        } else {
          setOptions("");
        }
      } else {
        setLabel("");
        setFieldType("text");
        setPlaceholder("");
        setRequired(false);
        setOptions("");
      }
    }
  }, [state.open, state.mode, state.field]);

  const handleSave = () => {
    if (!label.trim()) return;
    const optionsJson =
      fieldType === "select" && options.trim()
        ? JSON.stringify(
            options
              .split("\n")
              .map((o) => o.trim())
              .filter(Boolean)
          )
        : null;
    onSave({
      label: label.trim(),
      fieldType,
      placeholder: placeholder.trim() || null,
      required,
      options: optionsJson,
    });
  };

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state.mode === "add" ? "Add Field" : "Edit Field"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="field-label">
              Field Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Company Name"
              data-testid="input-field-label"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-type">Field Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger id="field-type" data-testid="select-field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="tel">Phone</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="select">Dropdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-placeholder">Placeholder (optional)</Label>
            <Input
              id="field-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="e.g. Acme Corp"
              data-testid="input-field-placeholder"
            />
          </div>

          {fieldType === "select" && (
            <div className="space-y-2">
              <Label htmlFor="field-options">
                Dropdown Options <span className="text-muted-foreground text-xs">(one per line)</span>
              </Label>
              <Textarea
                id="field-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder={"Option A\nOption B\nOption C"}
                rows={4}
                data-testid="textarea-field-options"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch
              id="field-required"
              checked={required}
              onCheckedChange={setRequired}
              data-testid="switch-field-required"
            />
            <Label htmlFor="field-required">Required field</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-field">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!label.trim()}
            data-testid="button-save-field"
          >
            {state.mode === "add" ? "Add Field" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormFieldsManager() {
  const { toast } = useToast();
  const [dialogState, setDialogState] = useState<FieldDialogState>({
    open: false,
    mode: "add",
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: fields = [], isLoading } = useQuery<FormField[]>({
    queryKey: ["/api/form-fields"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<FormField>) => {
      const res = await apiRequest("POST", "/api/form-fields", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-fields"] });
      toast({ title: "Field added", description: "Custom field created successfully." });
      setDialogState({ open: false, mode: "add" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add field.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormField> }) => {
      const res = await apiRequest("PUT", `/api/form-fields/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-fields"] });
      toast({ title: "Field updated", description: "Custom field saved." });
      setDialogState({ open: false, mode: "add" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update field.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/form-fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-fields"] });
      toast({ title: "Field deleted" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete field.", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("PUT", "/api/form-fields/reorder", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-fields"] });
    },
  });

  const handleSave = (data: Partial<FormField>) => {
    if (dialogState.mode === "add") {
      createMutation.mutate(data);
    } else if (dialogState.field) {
      updateMutation.mutate({ id: dialogState.field.id, data });
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...fields];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate(newOrder.map((f) => f.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === fields.length - 1) return;
    const newOrder = [...fields];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder.map((f) => f.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Form Fields
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fields guests must fill in when registering
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogState({ open: true, mode: "add" })}
          data-testid="button-add-field"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      <div className="space-y-2">
        {FIXED_FIELDS.map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2.5"
            data-testid={`row-fixed-field-${f.label}`}
          >
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm flex-1 text-muted-foreground">{f.label}</span>
            <Badge variant="secondary" className="text-xs">
              {FIELD_TYPE_LABELS[f.type] ?? f.type}
            </Badge>
            {f.required ? (
              <Badge variant="outline" className="text-xs">Required</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Optional</span>
            )}
          </div>
        ))}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-2 px-3">Loading fields...</div>
        ) : fields.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
            No custom fields yet. Click "Add Field" to add one.
          </div>
        ) : (
          fields.map((field, index) => (
            <div
              key={field.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2.5"
              data-testid={`row-custom-field-${field.id}`}
            >
              <div className="flex flex-col gap-0.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || reorderMutation.isPending}
                  data-testid={`button-move-up-${field.id}`}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === fields.length - 1 || reorderMutation.isPending}
                  data-testid={`button-move-down-${field.id}`}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>

              <span className="text-sm flex-1 font-medium">{field.label}</span>

              <Badge variant="secondary" className="text-xs shrink-0">
                {FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}
              </Badge>

              {field.required ? (
                <Badge variant="outline" className="text-xs shrink-0">Required</Badge>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">Optional</span>
              )}

              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDialogState({ open: true, mode: "edit", field })}
                  data-testid={`button-edit-field-${field.id}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleteId(field.id)}
                  data-testid={`button-delete-field-${field.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <FieldDialog
        state={dialogState}
        onClose={() => setDialogState({ open: false, mode: "add" })}
        onSave={handleSave}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this field? This will remove it from the check-in form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-field">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-field"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
        <p className="text-sm text-muted-foreground">
          This page is displayed on your reception screen. Guests scan the QR code to check in.
        </p>
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
  const [captchaBypassStart, setCaptchaBypassStart] = useState("");
  const [captchaBypassEnd, setCaptchaBypassEnd] = useState("");

  useEffect(() => {
    if (settings) {
      setEventName(settings.eventName ?? "");
      setTitle(settings.title ?? "Check-In");
      setDescription(settings.description ?? "Enter your phone number or email address to check in");
      setSuccessTitle(settings.successTitle ?? "Welcome!");
      setSuccessMessage(settings.successMessage ?? "You have been successfully checked in");
      setCaptchaBypassStart(settings.captchaBypassStart ?? "");
      setCaptchaBypassEnd(settings.captchaBypassEnd ?? "");
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
        captchaBypassStart: captchaBypassStart || null,
        captchaBypassEnd: captchaBypassEnd || null,
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
        <p className="text-sm text-muted-foreground">
          This is the form guests see on their phone after scanning the QR code.
        </p>
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

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Bot Protection — CAPTCHA Bypass</h3>
          <p className="text-xs text-muted-foreground mt-1">
            On these dates the visible CAPTCHA widget is hidden for real attendees. Silent bot detection still runs every day.
            Leave blank to always show the CAPTCHA widget.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="captcha-bypass-start">Event Start Date</Label>
            <Input
              id="captcha-bypass-start"
              type="date"
              value={captchaBypassStart}
              onChange={(e) => setCaptchaBypassStart(e.target.value)}
              disabled={isLoading}
              data-testid="input-captcha-bypass-start"
            />
            <p className="text-xs text-muted-foreground">First day CAPTCHA is hidden (YYYY-MM-DD)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="captcha-bypass-end">Event End Date</Label>
            <Input
              id="captcha-bypass-end"
              type="date"
              value={captchaBypassEnd}
              onChange={(e) => setCaptchaBypassEnd(e.target.value)}
              disabled={isLoading}
              data-testid="input-captcha-bypass-end"
            />
            <p className="text-xs text-muted-foreground">Last day CAPTCHA is hidden (inclusive)</p>
          </div>
        </div>

        {captchaBypassStart && captchaBypassEnd && captchaBypassStart > captchaBypassEnd && (
          <p className="text-xs text-destructive">Start date must be on or before end date.</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => mutation.mutate()}
          disabled={
            mutation.isPending ||
            isLoading ||
            !title.trim() ||
            !description.trim() ||
            (!!captchaBypassStart && !!captchaBypassEnd && captchaBypassStart > captchaBypassEnd)
          }
          data-testid="button-save-guest-page"
        >
          <Save className="mr-2 h-4 w-4" />
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Separator />

      <FormFieldsManager />
    </div>
  );
}

const GENERATED_HMAC_SECRET = "76eef017cfb02fa7a14ddc176969d25e0761e307d31ceb3152502bc312fd962e";

function SecurityStatusPanel() {
  const [copied, setCopied] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<{
    turnstile: boolean;
    hmacTiming: boolean;
    rateLimit: boolean;
  }>({
    queryKey: ["/api/admin/security-status"],
    refetchOnWindowFocus: false,
  });

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const layers = [
    {
      key: "rateLimit",
      label: "Rate Limiting",
      description: "Caps check-in attempts per IP — always active, no key needed.",
      active: status?.rateLimit ?? true,
      optional: false,
    },
    {
      key: "hmacTiming",
      label: "Timing Token (HMAC)",
      description: "Ensures the form was loaded before submission, blocking instant-replay bots.",
      active: status?.hmacTiming ?? false,
      optional: false,
      secretKey: "FINGERPRINT_HMAC_SECRET",
    },
    {
      key: "turnstile",
      label: "Cloudflare Turnstile CAPTCHA",
      description: "Optional ML-based CAPTCHA. Requires a free Cloudflare account. Form works without it.",
      active: status?.turnstile ?? false,
      optional: true,
      secretKey: "VITE_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY",
    },
  ];

  const requiredActive = !isLoading && layers.filter((l) => !l.optional).every((l) => l.active);
  const allActive = !isLoading && layers.every((l) => l.active);

  return (
    <div className="space-y-6" data-testid="section-security-status">
      <div className="space-y-1">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Protection Layers</h3>
        <p className="text-xs text-muted-foreground">
          {requiredActive
            ? "All required bot-protection layers are active."
            : "One or more required layers need a secret configured in Replit."}
        </p>
      </div>

      <div className="space-y-3">
        {layers.map((layer) => (
          <div
            key={layer.key}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
            data-testid={`security-layer-${layer.key}`}
          >
            {isLoading ? (
              <div className="h-5 w-5 rounded-full bg-muted animate-pulse mt-0.5" />
            ) : layer.active ? (
              <ShieldCheck className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            ) : layer.optional ? (
              <ShieldAlert className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{layer.label}</span>
                {!isLoading && (
                  <Badge
                    variant={layer.active ? "default" : "secondary"}
                    className={
                      layer.active
                        ? "bg-green-500 hover:bg-green-500 text-white text-xs"
                        : layer.optional
                        ? "text-xs text-muted-foreground"
                        : "text-xs"
                    }
                    data-testid={`badge-security-${layer.key}`}
                  >
                    {layer.active ? "Active" : layer.optional ? "Optional — not configured" : "Not configured"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{layer.description}</p>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Setup Instructions</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add keys to Replit Secrets (not environment variables) then restart the app. Rate limiting is always on — no setup needed.
          </p>
        </div>

        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-medium">Step 1 — Add the timing-token secret <span className="text-muted-foreground font-normal">(required)</span></p>
            <p className="text-xs text-muted-foreground">
              A unique value has been pre-generated. Copy it and add it to Replit Secrets as{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">FINGERPRINT_HMAC_SECRET</code>.
            </p>
            <div className="flex items-center gap-2 p-2 rounded bg-muted font-mono text-xs break-all">
              <span className="flex-1">{GENERATED_HMAC_SECRET}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => copyToClipboard(GENERATED_HMAC_SECRET, "hmac")}
                data-testid="button-copy-hmac-secret"
              >
                {copied === "hmac" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Step 2 — Add a Cloudflare Turnstile CAPTCHA <span className="text-muted-foreground font-normal">(optional)</span></p>
            <p className="text-xs text-muted-foreground">
              Skip this step if you don't use Cloudflare — the form works without it and all other protections still run.
              If you do want the CAPTCHA layer, sign up free at Cloudflare, create a Turnstile widget for your domain, then add the keys below.
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://dash.cloudflare.com/?to=/:account/turnstile" target="_blank" rel="noreferrer" className="underline underline-offset-2">dash.cloudflare.com → Turnstile</a> → Add site → choose <strong>Managed</strong></li>
              <li>Copy the <strong>Site Key</strong> → Replit Secrets → <code className="bg-muted px-1 py-0.5 rounded font-mono">VITE_TURNSTILE_SITE_KEY</code></li>
              <li>Copy the <strong>Secret Key</strong> → Replit Secrets → <code className="bg-muted px-1 py-0.5 rounded font-mono">TURNSTILE_SECRET_KEY</code></li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Step 3 — Restart the app</p>
            <p className="text-xs text-muted-foreground">
              After adding secrets in Replit, restart the workflow so the server picks up the new values.
              Return to this tab — the badges will update to confirm what's active.
            </p>
          </div>
        </div>
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
          <TabsTrigger value="security" data-testid="tab-security">
            <Lock className="mr-2 h-4 w-4" />
            Security
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

        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Bot Protection</CardTitle>
              <CardDescription>
                Status of all protection layers on the guest check-in form, and step-by-step setup instructions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SecurityStatusPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
