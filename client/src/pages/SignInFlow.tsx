import { useState, useEffect, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Lock,
  Camera,
  Users,
  FileText,
  ClipboardList,
  Monitor,
  RefreshCw,
  Search,
  UserCheck,
  Download,
  Upload,
  X,
  Clock,
  Calendar,
  History,
  StickyNote,
  ListFilter,
  GitMerge,
  BookUser,
  ArrowUpDown,
  AlertTriangle,
  UserCog,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { FormField, Customer, Lead, Visitor, AcePoc } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
}

interface KioskSettings {
  photoEnabled: boolean;
  plusOneEnabled: boolean;
  kioskTimeoutSeconds: number;
}

interface KioskDevice {
  id: string;
  deviceId: string;
  name: string | null;
  status: string;
  computedStatus: string;
  lastSeen: string;
  userAgent: string | null;
  ipAddress: string | null;
}

interface VisitorMergeEvent {
  id: string;
  primaryKey: string;
  secondaryName: string;
  secondaryEmail: string | null;
  visitsMoved: number;
  mergedAt: string;
}

// ─── Re-used from PublicPages: FormFieldsManager ──────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  email: "Email",
  tel: "Phone",
  number: "Number",
  select: "Dropdown",
};

const FIXED_FIELDS = [
  { label: "Title", type: "select", required: false },
  { label: "First Name", type: "text", required: true },
  { label: "Last Name", type: "text", required: true },
  { label: "Email", type: "email", required: true },
  { label: "Phone Number", type: "tel", required: true },
  { label: "Company", type: "text", required: false },
  { label: "Ace POC", type: "select", required: false },
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
            <Label htmlFor="sf-field-label">
              Field Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sf-field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Company Name"
              data-testid="input-sf-field-label"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sf-field-type">Field Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger id="sf-field-type" data-testid="select-sf-field-type">
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
            <Label htmlFor="sf-field-placeholder">Placeholder (optional)</Label>
            <Input
              id="sf-field-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="e.g. Acme Corp"
              data-testid="input-sf-field-placeholder"
            />
          </div>
          {fieldType === "select" && (
            <div className="space-y-2">
              <Label htmlFor="sf-field-options">
                Dropdown Options <span className="text-muted-foreground text-xs">(one per line)</span>
              </Label>
              <Textarea
                id="sf-field-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder={"Option A\nOption B\nOption C"}
                rows={4}
                data-testid="textarea-sf-field-options"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch
              id="sf-field-required"
              checked={required}
              onCheckedChange={setRequired}
              data-testid="switch-sf-field-required"
            />
            <Label htmlFor="sf-field-required">Required field</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-sf-cancel-field">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!label.trim()}
            data-testid="button-sf-save-field"
          >
            {state.mode === "add" ? "Add Field" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignInFieldsTab() {
  const { toast } = useToast();
  const [dialogState, setDialogState] = useState<FieldDialogState>({ open: false, mode: "add" });
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
      toast({ title: "Field added" });
      setDialogState({ open: false, mode: "add" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add field.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormField> }) => {
      const res = await apiRequest("PUT", `/api/form-fields/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-fields"] });
      toast({ title: "Field updated" });
      setDialogState({ open: false, mode: "add" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update field.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/form-fields/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-fields"] });
      toast({ title: "Field deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete field.", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => { await apiRequest("PUT", "/api/form-fields/reorder", { ids }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/form-fields"] }),
  });

  const handleSave = (data: Partial<FormField>) => {
    if (dialogState.mode === "add") createMutation.mutate(data);
    else if (dialogState.field) updateMutation.mutate({ id: dialogState.field.id, data });
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
          <p className="text-sm text-muted-foreground">
            These fields appear on the kiosk sign-in form. Fixed fields are always shown; custom fields can be added, edited, or reordered.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogState({ open: true, mode: "add" })} data-testid="button-sf-add-field">
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      <div className="space-y-2">
        {FIXED_FIELDS.map((f) => (
          <div key={f.label} className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm flex-1 text-muted-foreground">{f.label}</span>
            <Badge variant="secondary" className="text-xs w-16 justify-center">{FIELD_TYPE_LABELS[f.type] ?? f.type}</Badge>
            <div className="w-16 flex justify-end">
              {f.required ? (
                <Badge variant="outline" className="text-xs">Required</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Optional</span>
              )}
            </div>
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
            <div key={field.id} className="flex items-center gap-3 rounded-md border px-3 py-2.5" data-testid={`row-sf-field-${field.id}`}>
              <div className="flex flex-col gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleMoveUp(index)} disabled={index === 0 || reorderMutation.isPending} data-testid={`button-sf-move-up-${field.id}`}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleMoveDown(index)} disabled={index === fields.length - 1 || reorderMutation.isPending} data-testid={`button-sf-move-down-${field.id}`}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-sm flex-1 font-medium">{field.label}</span>
              <Badge variant="secondary" className="text-xs shrink-0 w-16 justify-center">{FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}</Badge>
              <div className="w-16 flex justify-end shrink-0">
                {field.required ? (
                  <Badge variant="outline" className="text-xs">Required</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Optional</span>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => setDialogState({ open: true, mode: "edit", field })} data-testid={`button-sf-edit-field-${field.id}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteId(field.id)} data-testid={`button-sf-delete-field-${field.id}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <FieldDialog state={dialogState} onClose={() => setDialogState({ open: false, mode: "add" })} onSave={handleSave} />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this field?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-sf-cancel-delete-field">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} data-testid="button-sf-confirm-delete-field">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

interface DocFormState {
  open: boolean;
  mode: "add" | "edit";
  doc?: Document;
}

function DocumentsTab() {
  const { toast } = useToast();
  const [formState, setFormState] = useState<DocFormState>({ open: false, mode: "add" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  useEffect(() => {
    if (formState.open) {
      if (formState.mode === "edit" && formState.doc) {
        setDocTitle(formState.doc.title);
        setDocContent(formState.doc.content);
      } else {
        setDocTitle("");
        setDocContent("");
      }
    }
  }, [formState.open, formState.mode, formState.doc]);

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const res = await apiRequest("POST", "/api/documents", { ...data, enabled: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document added" });
      setFormState({ open: false, mode: "add" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add document.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Document> }) => {
      const res = await apiRequest("PUT", `/api/documents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document updated" });
      setFormState({ open: false, mode: "add" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update document.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/documents/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => { await apiRequest("PUT", "/api/documents/reorder", { ids }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/documents"] }),
  });

  const toggleEnabled = (doc: Document) => {
    updateMutation.mutate({ id: doc.id, data: { enabled: !doc.enabled } });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...docs];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate(newOrder.map((d) => d.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === docs.length - 1) return;
    const newOrder = [...docs];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder.map((d) => d.id));
  };

  const handleSave = () => {
    if (!docTitle.trim() || !docContent.trim()) return;
    if (formState.mode === "add") {
      createMutation.mutate({ title: docTitle.trim(), content: docContent.trim() });
    } else if (formState.doc) {
      updateMutation.mutate({ id: formState.doc.id, data: { title: docTitle.trim(), content: docContent.trim() } });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Legal documents shown to visitors during kiosk check-in. Each enabled document requires a tap of "I Agree" to proceed.
        </p>
        <Button size="sm" onClick={() => setFormState({ open: true, mode: "add" })} data-testid="button-add-document">
          <Plus className="mr-2 h-4 w-4" />
          Add Document
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-2">Loading documents...</div>
      ) : docs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
          No documents yet. Click "Add Document" to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc, index) => (
            <div key={doc.id} className="flex items-start gap-3 rounded-md border px-3 py-3" data-testid={`row-document-${doc.id}`}>
              <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleMoveUp(index)} disabled={index === 0 || reorderMutation.isPending} data-testid={`button-doc-move-up-${doc.id}`}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleMoveDown(index)} disabled={index === docs.length - 1 || reorderMutation.isPending} data-testid={`button-doc-move-down-${doc.id}`}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{doc.title}</span>
                  {doc.enabled ? (
                    <Badge variant="default" className="text-xs shrink-0">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs shrink-0">Disabled</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{doc.content}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={doc.enabled}
                  onCheckedChange={() => toggleEnabled(doc)}
                  data-testid={`switch-doc-enabled-${doc.id}`}
                />
                <Button size="icon" variant="ghost" onClick={() => setFormState({ open: true, mode: "edit", doc })} data-testid={`button-edit-document-${doc.id}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteId(doc.id)} data-testid={`button-delete-document-${doc.id}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formState.open} onOpenChange={(open) => !open && setFormState({ open: false, mode: "add" })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formState.mode === "add" ? "Add Document" : "Edit Document"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title <span className="text-destructive">*</span></Label>
              <Input id="doc-title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Non-Disclosure Agreement" data-testid="input-doc-title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-content">Content <span className="text-destructive">*</span></Label>
              <Textarea id="doc-content" value={docContent} onChange={(e) => setDocContent(e.target.value)} placeholder="Enter the full text of the document..." rows={8} data-testid="textarea-doc-content" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormState({ open: false, mode: "add" })} data-testid="button-cancel-document">Cancel</Button>
            <Button onClick={handleSave} disabled={!docTitle.trim() || !docContent.trim() || createMutation.isPending || updateMutation.isPending} data-testid="button-save-document">
              {formState.mode === "add" ? "Add Document" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This document will be removed from the kiosk check-in flow.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-document">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} data-testid="button-confirm-delete-document">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Photo Tab ────────────────────────────────────────────────────────────────

function PhotoTab() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<KioskSettings>({ queryKey: ["/api/kiosk/settings"] });
  const [photoEnabled, setPhotoEnabled] = useState(false);

  useEffect(() => {
    if (settings) setPhotoEnabled(settings.photoEnabled);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PUT", "/api/kiosk/settings", { photoEnabled: enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiosk/settings"] });
      toast({ title: "Photo setting saved" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save photo setting.", variant: "destructive" }),
  });

  const handleToggle = (val: boolean) => {
    setPhotoEnabled(val);
    mutation.mutate(val);
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-sm">Capture visitor photo</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      When enabled, the kiosk will ask visitors to take a photo during check-in using the device camera.
                    </p>
                  </div>
                  <Switch
                    checked={photoEnabled}
                    onCheckedChange={handleToggle}
                    disabled={mutation.isPending}
                    data-testid="switch-photo-enabled"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Plus One Tab ─────────────────────────────────────────────────────────────

function PlusOneTab() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<KioskSettings>({ queryKey: ["/api/kiosk/settings"] });
  const [plusOneEnabled, setPlusOneEnabled] = useState(false);
  const [timeoutSecs, setTimeoutSecs] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setPlusOneEnabled(settings.plusOneEnabled);
      setTimeoutSecs(settings.kioskTimeoutSeconds);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (data: { plusOneEnabled: boolean; kioskTimeoutSeconds: number }) => {
      const res = await apiRequest("PUT", "/api/kiosk/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiosk/settings"] });
      toast({ title: "Settings saved" });
      setSaving(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      setSaving(false);
    },
  });

  const handleSave = () => {
    const secs = Math.min(300, Math.max(5, timeoutSecs || 30));
    setSaving(true);
    mutation.mutate({ plusOneEnabled, kioskTimeoutSeconds: secs });
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-sm">Enable plus one sign-in</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        When enabled, the kiosk asks visitors how many people are in their group.
                      </p>
                    </div>
                    <Switch
                      checked={plusOneEnabled}
                      onCheckedChange={setPlusOneEnabled}
                      data-testid="switch-plus-one-enabled"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-sm">Auto-logout timeout</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    If a visitor is idle for this many seconds during check-in, the kiosk resets to the idle screen. (5 – 300 seconds)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={5}
                    max={300}
                    value={timeoutSecs}
                    onChange={(e) => setTimeoutSecs(Number(e.target.value))}
                    className="w-28"
                    data-testid="input-kiosk-timeout"
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving || mutation.isPending} data-testid="button-save-plus-one-settings">
            Save Settings
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Devices Tab ──────────────────────────────────────────────────────────────

function DevicesTab() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: devices = [], isLoading, refetch } = useQuery<KioskDevice[]>({
    queryKey: ["/api/kiosk/devices"],
    refetchInterval: 30000,
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PUT", `/api/kiosk/devices/${id}`, { name: name || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiosk/devices"] });
      toast({ title: "Device renamed" });
      setEditingId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to rename device.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/kiosk/devices/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kiosk/devices"] });
      toast({ title: "Device removed" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to remove device.", variant: "destructive" }),
  });

  const statusColor = (status: string) => {
    if (status === "active") return "bg-green-500";
    if (status === "idle") return "bg-gray-400";
    return "bg-red-500";
  };

  const statusLabel = (status: string) => {
    if (status === "active") return "Active";
    if (status === "idle") return "Idle";
    return "Offline";
  };

  const parseUA = (ua: string | null): string => {
    if (!ua) return "Unknown";
    if (ua.includes("iPad")) return "iPad";
    if (ua.includes("iPhone")) return "iPhone";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Firefox")) return "Firefox";
    return ua.slice(0, 40);
  };

  const kioskUrl = `${window.location.origin}/kiosk`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Every iPad or tablet that has opened the kiosk URL appears here. A device is Offline if its heartbeat hasn't been received in over 2 minutes.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-refresh-devices">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(kioskUrl); toast({ title: "Copied", description: "Kiosk URL copied to clipboard." }); }} data-testid="button-copy-kiosk-url">
            Copy Kiosk URL
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-2">Loading devices...</div>
      ) : devices.length === 0 ? (
        <div className="py-10 text-center border border-dashed rounded-md space-y-2">
          <Monitor className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No devices have connected yet.</p>
          <p className="text-xs text-muted-foreground">Open <code className="bg-muted px-1 rounded">/kiosk</code> on an iPad or tablet to register it.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <div key={device.id} className="rounded-md border px-4 py-3 flex items-center gap-4" data-testid={`row-device-${device.id}`}>
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColor(device.computedStatus)}`} />
              <div className="flex-1 min-w-0">
                {editingId === device.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="Device name"
                      className="h-7 text-sm w-48"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameMutation.mutate({ id: device.id, name: editingName });
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      data-testid={`input-device-name-${device.id}`}
                    />
                    <Button size="sm" className="h-7" onClick={() => renameMutation.mutate({ id: device.id, name: editingName })} data-testid={`button-save-device-name-${device.id}`}>Save</Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="font-medium text-sm">
                    {device.name || <span className="text-muted-foreground italic">Unnamed device</span>}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground font-mono">{device.deviceId.slice(0, 12)}…</span>
                  <Badge variant="outline" className="text-xs">{statusLabel(device.computedStatus)}</Badge>
                  <span className="text-xs text-muted-foreground">Last seen {formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })}</span>
                  <span className="text-xs text-muted-foreground">{parseUA(device.userAgent)}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => { setEditingId(device.id); setEditingName(device.name ?? ""); }} data-testid={`button-rename-device-${device.id}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteId(device.id)} data-testid={`button-delete-device-${device.id}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Device</AlertDialogTitle>
            <AlertDialogDescription>This device will be removed from the registry. It can re-register next time it opens the kiosk.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-device">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} data-testid="button-confirm-delete-device">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Visitor Log Tab ──────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function sourceBadge(source: string) {
  if (source === "envoy")
    return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0">Envoy</Badge>;
  return <Badge variant="outline" className="text-xs">Kiosk</Badge>;
}

// Envoy CSV column mapping
const ENVOY_COL_MAP: Record<string, string> = {
  "your_full_name": "fullName",
  "your_email_address": "email",
  "organization_company": "company",
  "host": "acePoc",
  "signed_in_time_local": "signedInAt",
  "signed_out_time_local": "signedOutAt",
  "are_you_us_citizen_or_resident": "usCitizen",
  "are_you_a_us_citizen_or_resident": "usCitizen",
  "purpose_of_visit": "purpose",
  "location_name": "location",
};

function parseEnvoyRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const normalized = rawKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const mappedKey = ENVOY_COL_MAP[normalized] ?? normalized;
      mapped[mappedKey] = value;
    }
    return mapped;
  });
}

function formatDuration(signedInAt: string | Date, signedOutAt: string | Date | null): string {
  if (!signedOutAt) return "—";
  const diffMs = new Date(signedOutAt).getTime() - new Date(signedInAt).getTime();
  if (diffMs <= 0) return "—";
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

interface VisitorProfileResult {
  stats: {
    totalVisits: number;
    firstVisited: string | null;
    lastVisited: string | null;
    avgDurationMinutes: number | null;
  };
  visits: Visitor[];
}

interface GroupedVisitor {
  lookupKey: string;
  fullName: string;
  email: string | null;
  company: string | null;
  photoData: string | null;
  totalVisits: number;
  firstVisited: Date;
  lastVisited: Date;
  representative: Visitor;
}

type ImportPreviewRow = {
  fullName: string;
  email: string;
  company: string;
  signedInAt: string;
};

function visitorLookupKey(v: Visitor): string {
  return v.email?.toLowerCase().trim() || v.fullName.toLowerCase().trim();
}

function VisitorLogTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"by-visit" | "by-visitor">("by-visit");
  const [selected, setSelected] = useState<Visitor | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [allParsedRows, setAllParsedRows] = useState<Record<string, string>[]>([]);
  const [skipCount, setSkipCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allVisitors = [], isLoading, refetch } = useQuery<Visitor[]>({
    queryKey: ["/api/visitors"],
  });

  const { data: missingUsCitizenData } = useQuery<{ count: number }>({
    queryKey: ["/api/visitors/missing-us-citizen-count"],
  });
  const missingUsCitizenCount = missingUsCitizenData?.count ?? 0;

  const profileQueryKey = selected
    ? selected.email
      ? `/api/visitors/profile?email=${encodeURIComponent(selected.email)}`
      : `/api/visitors/profile?name=${encodeURIComponent(selected.fullName)}`
    : null;

  const { data: profile, isLoading: profileLoading } = useQuery<VisitorProfileResult>({
    queryKey: [profileQueryKey],
    enabled: profileQueryKey !== null,
  });

  const notesLookupKey = selected ? visitorLookupKey(selected) : null;

  const { data: notesData, isLoading: notesLoading } = useQuery<{ lookupKey: string; notes: string }>({
    queryKey: ["/api/visitors/notes", notesLookupKey],
    enabled: notesLookupKey !== null,
  });

  const { data: mergeEvents = [] } = useQuery<VisitorMergeEvent[]>({
    queryKey: [`/api/visitors/merge-events?key=${encodeURIComponent(notesLookupKey!)}`],
    enabled: notesLookupKey !== null,
  });

  const saveNotesMutation = useMutation({
    mutationFn: ({ key, notes }: { key: string; notes: string }) =>
      apiRequest("PUT", "/api/visitors/notes", { key, notes }),
    onSuccess: () => {
      toast({ title: "Notes saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors/notes", notesLookupKey] });
    },
    onError: () => toast({ title: "Failed to save notes", variant: "destructive" }),
  });

  useEffect(() => {
    setNotesDraft(notesData?.notes ?? "");
  }, [notesData, selected]);

  // Group all visitors by person (email → fullName fallback) for "by-visitor" view
  const groupedVisitors = useMemo<GroupedVisitor[]>(() => {
    const map = new Map<string, GroupedVisitor>();
    for (const v of allVisitors) {
      const key = visitorLookupKey(v);
      const vDate = new Date(v.signedInAt);
      if (map.has(key)) {
        const g = map.get(key)!;
        g.totalVisits++;
        if (vDate < g.firstVisited) g.firstVisited = vDate;
        if (vDate > g.lastVisited) { g.lastVisited = vDate; g.representative = v; }
      } else {
        map.set(key, {
          lookupKey: key,
          fullName: v.fullName,
          email: v.email,
          company: v.company,
          photoData: v.photoData,
          totalVisits: 1,
          firstVisited: vDate,
          lastVisited: vDate,
          representative: v,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastVisited.getTime() - a.lastVisited.getTime());
  }, [allVisitors]);

  const filtered = allVisitors.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.fullName.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.company?.toLowerCase().includes(q) ||
      false
    );
  });

  const filteredGrouped = groupedVisitors.filter((g) => {
    const q = search.toLowerCase();
    return (
      g.fullName.toLowerCase().includes(q) ||
      g.email?.toLowerCase().includes(q) ||
      g.company?.toLowerCase().includes(q) ||
      false
    );
  });

  const resetImport = () => {
    setPreviewRows([]);
    setAllParsedRows([]);
    setSkipCount(0);
  };

  const handleEnvoyFileSelect = async (file: File) => {
    try {
      const Papa = (await import("papaparse")).default;
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) {
        toast({ title: "CSV parse error", description: parsed.errors[0].message, variant: "destructive" });
        return;
      }
      const rows = parseEnvoyRows(parsed.data);
      const skipped = rows.filter((r) => !r.fullName && !r.email).length;
      const valid = rows.filter((r) => r.fullName || r.email);
      setSkipCount(skipped);
      setAllParsedRows(valid);
      setPreviewRows(
        valid.slice(0, 5).map((r) => ({
          fullName: r.fullName ?? "",
          email: r.email ?? "",
          company: r.company ?? "",
          signedInAt: r.signedInAt ?? "",
        }))
      );
    } catch (err: any) {
      toast({ title: "Failed to read file", description: err?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const IMPORT_KEYS = ["fullName","email","company","acePoc","ace_poc","signedInAt","signedOutAt","usCitizen","us_citizen","purpose","location","notes"] as const;

  const handleConfirmImport = async () => {
    setImporting(true);
    const slimRows = allParsedRows.map((row) => {
      const slim: Record<string, string> = {};
      for (const key of IMPORT_KEYS) { if (key in row) slim[key] = row[key]; }
      return slim;
    });
    try {
      const res = await apiRequest("POST", "/api/visitors/bulk-import", { rows: slimRows });
      const result = await res.json();
      toast({ title: "Import complete", description: result.message });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors/missing-us-citizen-count"] });
      setImportOpen(false);
      resetImport();
    } catch (err: any) {
      toast({ title: "Import failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    }
    setImporting(false);
  };

  const displayCount = isLoading ? null
    : viewMode === "by-visitor"
      ? `${filteredGrouped.length} unique visitor${filteredGrouped.length !== 1 ? "s" : ""}`
      : `${filtered.length} visit${filtered.length !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Search by name, email, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-visitor-search"
          />
        </div>
        {/* View mode toggle */}
        <div className="flex gap-1 rounded-md border p-0.5 bg-muted/30">
          <button
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${viewMode === "by-visit" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setViewMode("by-visit")}
            data-testid="button-view-by-visit"
          >
            By visit
          </button>
          <button
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded font-medium transition-colors ${viewMode === "by-visitor" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setViewMode("by-visitor")}
            data-testid="button-view-by-visitor"
          >
            <ListFilter className="h-3 w-3" />
            By visitor
          </button>
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {isLoading ? "Loading…" : displayCount}
        </span>
        <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-refresh-visitors">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={() => { resetImport(); setImportOpen(true); }} data-testid="button-import-envoy">
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Import Envoy CSV
        </Button>
      </div>

      {missingUsCitizenCount > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3" data-testid="banner-missing-us-citizen">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              {missingUsCitizenCount} Envoy record{missingUsCitizenCount !== 1 ? "s are" : " is"} missing the "US Citizen or Resident" answer
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Re-import the original Envoy CSV to backfill these answers. Existing records will be updated automatically — no duplicates will be created.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
            onClick={() => { resetImport(); setImportOpen(true); }}
            data-testid="button-backfill-us-citizen"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Re-import CSV
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading visitors…</div>
      ) : viewMode === "by-visitor" ? (
        /* ── By-visitor grouped list ── */
        filteredGrouped.length === 0 ? (
          <div className="py-12 text-center border border-dashed rounded-md space-y-2">
            <UserCheck className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              {search ? "No visitors match your search." : "No visitors yet."}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <div className="hidden lg:grid grid-cols-[2rem_1fr_1fr_72px_88px_88px] gap-x-3 px-4 py-2 bg-muted/40 border-b text-xs font-medium text-muted-foreground items-center">
              <span />
              <span>Name / Email</span>
              <span>Company</span>
              <span>Visits</span>
              <span>First visited</span>
              <span>Last visited</span>
            </div>
            <div className="divide-y">
              {filteredGrouped.map((g) => (
                <button
                  key={g.lookupKey}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 lg:grid lg:grid-cols-[2rem_1fr_1fr_72px_88px_88px] lg:gap-x-3 lg:items-center hover:bg-muted/30 transition-colors"
                  onClick={() => setSelected(g.representative)}
                  data-testid={`row-grouped-${g.lookupKey}`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {g.photoData ? (
                      <img src={g.photoData} alt={g.fullName} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(g.fullName).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 lg:flex-none min-w-0">
                    <div className="text-sm font-medium truncate">{g.fullName}</div>
                    <div className="text-xs text-muted-foreground truncate">{g.email || "—"}</div>
                  </div>
                  <div className="hidden lg:block text-sm text-muted-foreground truncate">{g.company || "—"}</div>
                  <div className="hidden lg:flex items-center gap-1 text-xs font-semibold">
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    {g.totalVisits}
                  </div>
                  <div className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                    {g.firstVisited.toLocaleDateString()}
                  </div>
                  <div className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                    {g.lastVisited.toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      ) : filtered.length === 0 ? (
        /* ── By-visit: empty state ── */
        <div className="py-12 text-center border border-dashed rounded-md space-y-2">
          <UserCheck className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {search ? "No visitors match your search." : "No kiosk check-ins yet."}
          </p>
        </div>
      ) : (
        /* ── By-visit: individual rows ── */
        <div className="rounded-md border overflow-hidden">
          <div className="hidden lg:grid grid-cols-[2rem_1fr_1fr_1fr_88px_88px_56px_64px] gap-x-3 px-4 py-2 bg-muted/40 border-b text-xs font-medium text-muted-foreground items-center">
            <span />
            <span>Name / Email</span>
            <span>Company</span>
            <span>ACE POC</span>
            <span>Signed In</span>
            <span>Signed Out</span>
            <span>Duration</span>
            <span>Source</span>
          </div>
          <div className="divide-y">
            {filtered.map((visitor) => (
              <button
                key={visitor.id}
                className="w-full text-left px-4 py-3 flex items-center gap-3 lg:grid lg:grid-cols-[2rem_1fr_1fr_1fr_88px_88px_56px_64px] lg:gap-x-3 lg:items-center hover:bg-muted/30 transition-colors"
                onClick={() => setSelected(visitor)}
                data-testid={`row-visitor-${visitor.id}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {visitor.photoData ? (
                    <img src={visitor.photoData} alt={visitor.fullName} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(visitor.fullName).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 lg:flex-none min-w-0">
                  <div className="text-sm font-medium truncate">{visitor.fullName}</div>
                  <div className="text-xs text-muted-foreground truncate">{visitor.email || "—"}</div>
                </div>
                <div className="hidden lg:block text-sm text-muted-foreground truncate">{visitor.company || "—"}</div>
                <div className="hidden lg:block text-sm text-muted-foreground truncate">{visitor.acePoc || "—"}</div>
                <div className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(visitor.signedInAt).toLocaleDateString()}
                </div>
                <div className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                  {visitor.signedOutAt ? new Date(visitor.signedOutAt).toLocaleDateString() : "—"}
                </div>
                <div className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                  {formatDuration(visitor.signedInAt, visitor.signedOutAt)}
                </div>
                <div className="shrink-0">{sourceBadge(visitor.source)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visitor profile sheet */}
      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle>Visitor Profile</SheetTitle>
              </SheetHeader>

              {/* Header: avatar + name + email + company */}
              <div className="flex items-center gap-4 pb-5 border-b">
                {selected.photoData ? (
                  <img src={selected.photoData} alt="Visitor photo" className="h-16 w-16 rounded-full object-cover border shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border">
                    <span className="text-xl font-semibold text-primary">{getInitials(selected.fullName).toUpperCase()}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-lg font-semibold">{selected.fullName}</div>
                  {selected.email && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span className="text-muted-foreground/60">✉</span>
                      <span className="truncate">{selected.email}</span>
                    </div>
                  )}
                  {selected.company && (
                    <div className="text-sm text-muted-foreground mt-0.5">{selected.company}</div>
                  )}
                </div>
              </div>

              {/* Stat chips */}
              {profileLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="rounded-lg border bg-muted/30 p-3 animate-pulse h-16" />
                  ))}
                </div>
              ) : profile && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                      <History className="h-3.5 w-3.5" />
                      Total visits
                    </div>
                    <div className="text-2xl font-bold">{profile.stats.totalVisits}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      First visited
                    </div>
                    <div className="text-sm font-semibold">
                      {profile.stats.firstVisited
                        ? new Date(profile.stats.firstVisited).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Last visited
                    </div>
                    <div className="text-sm font-semibold">
                      {profile.stats.lastVisited
                        ? new Date(profile.stats.lastVisited).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      Avg duration
                    </div>
                    <div className="text-sm font-semibold">
                      {profile.stats.avgDurationMinutes != null
                        ? (() => {
                            const h = Math.floor(profile.stats.avgDurationMinutes / 60);
                            const m = profile.stats.avgDurationMinutes % 60;
                            return h > 0 ? `${h}h ${m}m` : `${m}m`;
                          })()
                        : "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* Visit history */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Previous visits</h3>

                {profileLoading ? (
                  <div className="space-y-2">
                    {[0,1,2].map(i => (
                      <div key={i} className="h-12 rounded-md bg-muted/30 animate-pulse" />
                    ))}
                  </div>
                ) : !profile || profile.visits.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No visits found.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-x-auto">
                      <div className="min-w-[885px]">
                        <div className="grid grid-cols-[110px_80px_80px_90px_65px_90px_150px_80px_70px_65px] gap-x-2 px-3 py-2 bg-muted/40 border-b text-xs font-medium text-muted-foreground">
                          <span>Date</span>
                          <span>Signed In</span>
                          <span>Signed Out</span>
                          <span>Purpose</span>
                          <span>Citizen?</span>
                          <span>ACE POC</span>
                          <span>Email</span>
                          <span>Status</span>
                          <span>Duration</span>
                          <span>Source</span>
                        </div>
                        <div className="divide-y max-h-96 overflow-y-auto">
                          {profile.visits.map((v) => (
                            <div
                              key={v.id}
                              className="grid grid-cols-[110px_80px_80px_90px_65px_90px_150px_80px_70px_65px] gap-x-2 px-3 py-2.5 items-center text-xs"
                              data-testid={`profile-visit-${v.id}`}
                            >
                              <div className="font-medium text-foreground whitespace-nowrap">
                                {new Date(v.signedInAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                              <div className="text-muted-foreground whitespace-nowrap">
                                {new Date(v.signedInAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </div>
                              <div className="text-muted-foreground whitespace-nowrap">
                                {v.signedOutAt
                                  ? new Date(v.signedOutAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                                  : "—"}
                              </div>
                              <div className="truncate text-muted-foreground">
                                {v.purpose || "—"}
                              </div>
                              <div className="text-muted-foreground">
                                {v.usCitizen || "—"}
                              </div>
                              <div className="truncate text-muted-foreground">
                                {v.acePoc || "—"}
                              </div>
                              <div className="truncate text-muted-foreground">
                                {v.email || "—"}
                              </div>
                              <div>
                                {v.signedOutAt
                                  ? <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 text-[10px] px-1.5 py-0 whitespace-nowrap">Signed out</Badge>
                                  : <Badge variant="outline" className="text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-[10px] px-1.5 py-0 whitespace-nowrap">Signed in</Badge>
                                }
                              </div>
                              <div className="text-muted-foreground whitespace-nowrap">
                                {formatDuration(v.signedInAt, v.signedOutAt)}
                              </div>
                              <div>{sourceBadge(v.source)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Per-visit notes from kiosk form */}
                {selected.notes && (
                  <div className="pt-2 space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Notes (this visit)</div>
                    <p className="text-sm">{selected.notes}</p>
                  </div>
                )}
              </div>

              {/* Merge history */}
              {mergeEvents.length > 0 && (
                <div className="space-y-2 pt-4 border-t mt-4">
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Merge history</span>
                  </div>
                  <div className="rounded-md border divide-y">
                    {mergeEvents.map(ev => (
                      <div key={ev.id} className="px-3 py-2.5 text-xs space-y-0.5" data-testid={`merge-event-${ev.id}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{ev.secondaryName}</span>
                          {ev.secondaryEmail && (
                            <span className="text-muted-foreground">{ev.secondaryEmail}</span>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">
                            {ev.visitsMoved} visit{ev.visitsMoved !== 1 ? "s" : ""} absorbed
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {new Date(ev.mergedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" at "}
                          {new Date(ev.mergedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internal staff notes */}
              <div className="space-y-2 pt-4 border-t mt-4">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Internal notes</span>
                  <span className="text-xs text-muted-foreground ml-auto">Only visible to your team</span>
                </div>
                {notesLoading ? (
                  <div className="h-20 rounded-md bg-muted/30 animate-pulse" />
                ) : (
                  <Textarea
                    placeholder="Add notes for your team about this visitor…"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    className="resize-none text-sm"
                    rows={3}
                    data-testid="textarea-visitor-notes"
                  />
                )}
                <Button
                  size="sm"
                  disabled={saveNotesMutation.isPending || notesLoading}
                  onClick={() => {
                    if (notesLookupKey) saveNotesMutation.mutate({ key: notesLookupKey, notes: notesDraft });
                  }}
                  data-testid="button-save-visitor-notes"
                >
                  {saveNotesMutation.isPending ? "Saving…" : "Save notes"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Envoy import dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) resetImport(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Envoy CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {previewRows.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Upload a visitor log exported from Envoy. Duplicate entries (same name + date) will be skipped automatically.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEnvoyFileSelect(f); e.target.value = ""; }}
                  data-testid="input-envoy-file"
                />
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-choose-envoy-file"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV file
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">{allParsedRows.length} row{allParsedRows.length !== 1 ? "s" : ""} ready to import</span>
                  {skipCount > 0 && (
                    <span className="text-muted-foreground">{skipCount} row{skipCount !== 1 ? "s" : ""} skipped (missing name and email)</span>
                  )}
                </div>
                <div className="rounded-md border overflow-hidden">
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-x-3 px-3 py-2 bg-muted/40 border-b text-xs font-medium text-muted-foreground">
                    <span>Full Name</span>
                    <span>Email</span>
                    <span>Company</span>
                    <span>Signed In</span>
                  </div>
                  <div className="divide-y max-h-52 overflow-y-auto">
                    {previewRows.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-x-3 px-3 py-2 text-sm">
                        <span className="truncate">{row.fullName || "—"}</span>
                        <span className="truncate text-muted-foreground">{row.email || "—"}</span>
                        <span className="truncate text-muted-foreground">{row.company || "—"}</span>
                        <span className="truncate text-muted-foreground">{row.signedInAt || "—"}</span>
                      </div>
                    ))}
                    {allParsedRows.length > 5 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground italic">
                        …and {allParsedRows.length - 5} more row{allParsedRows.length - 5 !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setImportOpen(false); resetImport(); }} disabled={importing} data-testid="button-cancel-import">
              Cancel
            </Button>
            {previewRows.length > 0 && (
              <Button onClick={handleConfirmImport} disabled={importing} data-testid="button-confirm-import">
                {importing ? "Importing…" : `Import ${allParsedRows.length} row${allParsedRows.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab() {
  type SortField = "lastVisited" | "firstVisited" | "name" | "company" | "visits";
  type SortDir = "asc" | "desc";

  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergePickedPrimary, setMergePickedPrimary] = useState<string | null>(null);
  const [profileSelected, setProfileSelected] = useState<Visitor | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<GroupedVisitor | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteContact, setDeleteContact] = useState<GroupedVisitor | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastVisited");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showDupsOnly, setShowDupsOnly] = useState(false);
  const [mergeCountdown, setMergeCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (mergeCountdown === null) return;
    if (mergeCountdown <= 0) {
      setShowDupsOnly(false);
      setMergeCountdown(null);
      return;
    }
    const t = setTimeout(() => setMergeCountdown(c => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [mergeCountdown]);

  const { data: allVisitors = [], isLoading } = useQuery<Visitor[]>({
    queryKey: ["/api/visitors"],
  });

  const profileQueryKey = profileSelected
    ? profileSelected.email
      ? `/api/visitors/profile?email=${encodeURIComponent(profileSelected.email)}`
      : `/api/visitors/profile?name=${encodeURIComponent(profileSelected.fullName)}`
    : null;

  const { data: profile, isLoading: profileLoading } = useQuery<VisitorProfileResult>({
    queryKey: [profileQueryKey],
    enabled: profileQueryKey !== null,
  });

  const notesLookupKey = profileSelected ? visitorLookupKey(profileSelected) : null;

  const { data: notesData, isLoading: notesLoading } = useQuery<{ lookupKey: string; notes: string }>({
    queryKey: ["/api/visitors/notes", notesLookupKey],
    enabled: notesLookupKey !== null,
  });

  const { data: contactsMergeEvents = [] } = useQuery<VisitorMergeEvent[]>({
    queryKey: [`/api/visitors/merge-events?key=${encodeURIComponent(notesLookupKey!)}`],
    enabled: notesLookupKey !== null,
  });

  const saveNotesMutation = useMutation({
    mutationFn: ({ key, notes }: { key: string; notes: string }) =>
      apiRequest("PUT", "/api/visitors/notes", { key, notes }),
    onSuccess: () => {
      toast({ title: "Notes saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors/notes", notesLookupKey] });
    },
    onError: () => toast({ title: "Failed to save notes", variant: "destructive" }),
  });

  useEffect(() => {
    setNotesDraft(notesData?.notes ?? "");
  }, [notesData, profileSelected]);

  const groupedVisitors = useMemo<GroupedVisitor[]>(() => {
    const map = new Map<string, GroupedVisitor>();
    for (const v of allVisitors) {
      const key = visitorLookupKey(v);
      const vDate = new Date(v.signedInAt);
      if (map.has(key)) {
        const g = map.get(key)!;
        g.totalVisits++;
        if (vDate < g.firstVisited) g.firstVisited = vDate;
        if (vDate > g.lastVisited) { g.lastVisited = vDate; g.representative = v; }
      } else {
        map.set(key, {
          lookupKey: key, fullName: v.fullName, email: v.email, company: v.company,
          photoData: v.photoData, totalVisits: 1, firstVisited: vDate, lastVisited: vDate, representative: v,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastVisited.getTime() - a.lastVisited.getTime());
  }, [allVisitors]);

  const filteredGrouped = groupedVisitors.filter(g => {
    const q = search.toLowerCase();
    return g.fullName.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q) || g.company?.toLowerCase().includes(q) || false;
  });

  // Duplicate detection: flag contacts whose normalized name matches another contact's name
  const { duplicateKeys, duplicateGroups } = useMemo(() => {
    const nameMap = new Map<string, typeof groupedVisitors>();
    for (const g of groupedVisitors) {
      const n = g.fullName.toLowerCase().replace(/\s+/g, " ").trim();
      if (!nameMap.has(n)) nameMap.set(n, []);
      nameMap.get(n)!.push(g);
    }
    const flagged = new Set<string>();
    // Map from lookupKey → array of other contacts in the same duplicate group
    const groups = new Map<string, typeof groupedVisitors>();
    for (const [, visitors] of nameMap) {
      if (visitors.length > 1) {
        visitors.forEach(v => {
          flagged.add(v.lookupKey);
          groups.set(v.lookupKey, visitors.filter(o => o.lookupKey !== v.lookupKey));
        });
      }
    }
    return { duplicateKeys: flagged, duplicateGroups: groups };
  }, [groupedVisitors]);

  // Sort the filtered list
  const sortedFiltered = useMemo(() => {
    const arr = [...filteredGrouped];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.fullName.localeCompare(b.fullName); break;
        case "company": cmp = (a.company ?? "").localeCompare(b.company ?? ""); break;
        case "visits": cmp = a.totalVisits - b.totalVisits; break;
        case "firstVisited": cmp = a.firstVisited.getTime() - b.firstVisited.getTime(); break;
        default: cmp = a.lastVisited.getTime() - b.lastVisited.getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredGrouped, sortField, sortDir]);

  const displayList = showDupsOnly
    ? sortedFiltered.filter(g => duplicateKeys.has(g.lookupKey))
    : sortedFiltered;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "company" ? "asc" : "desc");
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-0.5 opacity-40 inline-block" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-0.5 text-primary inline-block" />
      : <ChevronDown className="h-3 w-3 ml-0.5 text-primary inline-block" />;
  };

  const checkedContacts = groupedVisitors.filter(g => checkedKeys.has(g.lookupKey));

  const toggleCheck = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else if (next.size < 2) { next.add(key); }
      return next;
    });
  };

  const mergeMutation = useMutation({
    mutationFn: ({ primaryKey, secondaryKey }: { primaryKey: string; secondaryKey: string }) =>
      apiRequest("POST", "/api/visitors/merge", { primaryKey, secondaryKey }),
    onSuccess: () => {
      toast({ title: "Contacts merged successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors/merge-events"] });
      setCheckedKeys(new Set());
      setMergeDialogOpen(false);
      setMergePickedPrimary(null);
      if (showDupsOnly) setMergeCountdown(5);
    },
    onError: () => toast({ title: "Merge failed", description: "Could not merge contacts.", variant: "destructive" }),
  });

  const handleConfirmMerge = () => {
    if (!mergePickedPrimary || checkedContacts.length !== 2) return;
    const secondary = checkedContacts.find(c => c.lookupKey !== mergePickedPrimary);
    if (!secondary) return;
    mergeMutation.mutate({ primaryKey: mergePickedPrimary, secondaryKey: secondary.lookupKey });
  };

  const editMutation = useMutation({
    mutationFn: (vars: { lookupKey: string; fullName: string; email: string; company: string; phoneNumber: string }) =>
      apiRequest("PUT", "/api/visitors/by-key", vars),
    onSuccess: () => {
      toast({ title: "Contact updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      setEditDialogOpen(false);
      setEditContact(null);
    },
    onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (lookupKey: string) =>
      apiRequest("DELETE", "/api/visitors/by-key", { lookupKey }),
    onSuccess: (_, lookupKey) => {
      toast({ title: "Contact deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      if (profileSelected && (profileSelected.email?.toLowerCase() === lookupKey.toLowerCase() || profileSelected.fullName.toLowerCase() === lookupKey.toLowerCase())) {
        setProfileSelected(null);
      }
      setDeleteConfirmOpen(false);
      setDeleteContact(null);
    },
    onError: () => toast({ title: "Failed to delete contact", variant: "destructive" }),
  });

  const handleOpenEdit = (g: GroupedVisitor, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContact(g);
    setEditName(g.fullName);
    setEditEmail(g.email ?? "");
    setEditCompany(g.company ?? "");
    setEditPhone(g.representative.phoneNumber ?? "");
    setEditDialogOpen(true);
  };

  const handleOpenDelete = (g: GroupedVisitor, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteContact(g);
    setDeleteConfirmOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Search by name, email, or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-contacts-search"
          />
        </div>

        {/* Sort control */}
        <Select value={`${sortField}:${sortDir}`} onValueChange={v => {
          const [f, d] = v.split(":") as [SortField, SortDir];
          setSortField(f); setSortDir(d);
        }}>
          <SelectTrigger className="h-9 w-44 text-xs" data-testid="select-contacts-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastVisited:desc">Last visited (newest)</SelectItem>
            <SelectItem value="lastVisited:asc">Last visited (oldest)</SelectItem>
            <SelectItem value="firstVisited:asc">First visited (oldest)</SelectItem>
            <SelectItem value="firstVisited:desc">First visited (newest)</SelectItem>
            <SelectItem value="name:asc">Name A → Z</SelectItem>
            <SelectItem value="name:desc">Name Z → A</SelectItem>
            <SelectItem value="company:asc">Company A → Z</SelectItem>
            <SelectItem value="company:desc">Company Z → A</SelectItem>
            <SelectItem value="visits:desc">Most visits</SelectItem>
            <SelectItem value="visits:asc">Fewest visits</SelectItem>
          </SelectContent>
        </Select>

        {/* Possible duplicates toggle */}
        {duplicateKeys.size > 0 && (
          <button
            className={`flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium transition-colors ${showDupsOnly ? "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300" : "border-input text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"}`}
            onClick={() => setShowDupsOnly(v => !v)}
            data-testid="button-show-duplicates"
          >
            <ListFilter className="h-3.5 w-3.5" />
            Possible duplicates
            <span className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${showDupsOnly ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100" : "bg-muted text-muted-foreground"}`}>
              {duplicateKeys.size}
            </span>
          </button>
        )}

        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {isLoading ? "Loading…" : `${displayList.length} contact${displayList.length !== 1 ? "s" : ""}`}
        </span>

        {checkedKeys.size === 2 && (
          <Button
            size="sm"
            onClick={() => { setMergePickedPrimary(checkedContacts[0]?.lookupKey ?? null); setMergeDialogOpen(true); }}
            data-testid="button-merge-contacts"
          >
            <GitMerge className="h-3.5 w-3.5 mr-1.5" />
            Merge contacts
          </Button>
        )}
        {checkedKeys.size === 1 && (
          <span className="text-xs text-muted-foreground">Select 1 more to merge</span>
        )}
        {checkedKeys.size > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setCheckedKeys(new Set())} data-testid="button-clear-selection">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Post-merge countdown banner */}
      {mergeCountdown !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-300">
          <GitMerge className="h-4 w-4 shrink-0" />
          <span>Merge complete. Returning to all contacts in {mergeCountdown}s…</span>
          <button className="ml-auto text-xs underline hover:no-underline" onClick={() => { setShowDupsOnly(false); setMergeCountdown(null); }}>
            Go now
          </button>
        </div>
      )}

      {/* Contact list */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading contacts…</div>
      ) : displayList.length === 0 ? (
        <div className="py-12 text-center border border-dashed rounded-md space-y-2">
          <UserCheck className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {showDupsOnly ? "No possible duplicates found." : search ? "No contacts match your search." : "No contacts yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <div className="hidden lg:grid grid-cols-[2.5rem_2rem_1fr_1fr_72px_88px_88px_64px] gap-x-3 px-4 py-2 bg-muted/40 border-b text-xs font-medium text-muted-foreground items-center">
            <span />
            <span />
            <button className="flex items-center text-left hover:text-foreground transition-colors" onClick={() => handleSort("name")} data-testid="th-contacts-name">
              Name / Email{sortIcon("name")}
            </button>
            <button className="flex items-center text-left hover:text-foreground transition-colors" onClick={() => handleSort("company")} data-testid="th-contacts-company">
              Company{sortIcon("company")}
            </button>
            <button className="flex items-center text-left hover:text-foreground transition-colors" onClick={() => handleSort("visits")} data-testid="th-contacts-visits">
              Visits{sortIcon("visits")}
            </button>
            <button className="flex items-center text-left hover:text-foreground transition-colors" onClick={() => handleSort("firstVisited")} data-testid="th-contacts-first">
              First visited{sortIcon("firstVisited")}
            </button>
            <button className="flex items-center text-left hover:text-foreground transition-colors" onClick={() => handleSort("lastVisited")} data-testid="th-contacts-last">
              Last visited{sortIcon("lastVisited")}
            </button>
            <span />
          </div>
          <div className="divide-y">
            {displayList.map(g => (
              <div
                key={g.lookupKey}
                className={`w-full px-4 py-3 flex items-center gap-3 lg:grid lg:grid-cols-[2.5rem_2rem_1fr_1fr_72px_88px_88px_64px] lg:gap-x-3 lg:items-center hover:bg-muted/30 transition-colors cursor-pointer ${checkedKeys.has(g.lookupKey) ? "bg-primary/5 hover:bg-primary/10" : ""}`}
                onClick={() => setProfileSelected(g.representative)}
                data-testid={`row-contact-${g.lookupKey}`}
              >
                <div className="flex items-center justify-center shrink-0" onClick={e => toggleCheck(g.lookupKey, e)}>
                  <input
                    type="checkbox"
                    readOnly
                    checked={checkedKeys.has(g.lookupKey)}
                    disabled={checkedKeys.size >= 2 && !checkedKeys.has(g.lookupKey)}
                    className="h-4 w-4 accent-primary cursor-pointer"
                    data-testid={`checkbox-contact-${g.lookupKey}`}
                  />
                </div>
                <Avatar className="h-8 w-8 shrink-0">
                  {g.photoData ? (
                    <img src={g.photoData} alt={g.fullName} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(g.fullName).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 lg:flex-none min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium truncate">{g.fullName}</span>
                    {duplicateKeys.has(g.lookupKey) && (
                      <Popover>
                        <PopoverTrigger onClick={e => e.stopPropagation()} className="contents">
                          <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-[10px] px-1.5 py-0 whitespace-nowrap shrink-0 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors" data-testid={`badge-duplicate-${g.lookupKey}`}>
                            Possible duplicate
                          </Badge>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3" align="start" onClick={e => e.stopPropagation()}>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Matched contacts</p>
                          <div className="flex flex-col gap-2">
                            {(duplicateGroups.get(g.lookupKey) ?? []).map(match => (
                              <div key={match.lookupKey} className="flex items-center gap-2 text-sm">
                                <Avatar className="h-6 w-6 shrink-0">
                                  {match.photoData ? (
                                    <img src={match.photoData} alt={match.fullName} className="h-full w-full rounded-full object-cover" />
                                  ) : (
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                      {getInitials(match.fullName).toUpperCase()}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate">{match.fullName}</div>
                                  <div className="text-xs text-muted-foreground truncate">{match.email || "—"} · {match.totalVisits} visit{match.totalVisits !== 1 ? "s" : ""}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs h-7"
                              data-testid={`button-select-both-${g.lookupKey}`}
                              onClick={e => {
                                e.stopPropagation();
                                const others = duplicateGroups.get(g.lookupKey) ?? [];
                                setCheckedKeys(new Set([g.lookupKey, ...others.slice(0, 1).map(o => o.lookupKey)]));
                              }}
                            >
                              Select both
                            </Button>
                            {checkedKeys.has(g.lookupKey) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 text-xs h-7 text-muted-foreground"
                                data-testid={`button-unselect-${g.lookupKey}`}
                                onClick={e => {
                                  e.stopPropagation();
                                  setCheckedKeys(prev => { const s = new Set(prev); s.delete(g.lookupKey); return s; });
                                }}
                              >
                                Unselect
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{g.email || "—"}</div>
                </div>
                <div className="hidden lg:block text-sm text-muted-foreground truncate">{g.company || "—"}</div>
                <div className="hidden lg:flex items-center gap-1 text-xs font-semibold">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  {g.totalVisits}
                </div>
                <div className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                  {g.firstVisited.toLocaleDateString()}
                </div>
                <div className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                  {g.lastVisited.toLocaleDateString()}
                </div>
                <div className="hidden lg:flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="Edit contact"
                    data-testid={`button-edit-contact-${g.lookupKey}`}
                    onClick={e => handleOpenEdit(g, e)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Delete contact"
                    data-testid={`button-delete-contact-${g.lookupKey}`}
                    onClick={e => handleOpenDelete(g, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visitor profile sheet */}
      <Sheet open={profileSelected !== null} onOpenChange={open => !open && setProfileSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {profileSelected && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle>Visitor Profile</SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-4 pb-5 border-b">
                {profileSelected.photoData ? (
                  <img src={profileSelected.photoData} alt="Visitor photo" className="h-16 w-16 rounded-full object-cover border shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border">
                    <span className="text-xl font-semibold text-primary">{getInitials(profileSelected.fullName).toUpperCase()}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-lg font-semibold">{profileSelected.fullName}</div>
                  {profileSelected.email && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span className="text-muted-foreground/60">✉</span>
                      <span className="truncate">{profileSelected.email}</span>
                    </div>
                  )}
                  {profileSelected.company && <div className="text-sm text-muted-foreground mt-0.5">{profileSelected.company}</div>}
                </div>
              </div>
              {profileLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
                  {[0,1,2,3].map(i => <div key={i} className="rounded-lg border bg-muted/30 p-3 animate-pulse h-16" />)}
                </div>
              ) : profile && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1"><History className="h-3.5 w-3.5" />Total visits</div>
                    <div className="text-2xl font-bold">{profile.stats.totalVisits}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1"><Calendar className="h-3.5 w-3.5" />First visited</div>
                    <div className="text-sm font-semibold">{profile.stats.firstVisited ? new Date(profile.stats.firstVisited).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1"><Calendar className="h-3.5 w-3.5" />Last visited</div>
                    <div className="text-sm font-semibold">{profile.stats.lastVisited ? new Date(profile.stats.lastVisited).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1"><Clock className="h-3.5 w-3.5" />Avg duration</div>
                    <div className="text-sm font-semibold">
                      {profile.stats.avgDurationMinutes != null
                        ? (() => { const h = Math.floor(profile.stats.avgDurationMinutes / 60); const m = profile.stats.avgDurationMinutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; })()
                        : "—"}
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Previous visits</h3>
                {profileLoading ? (
                  <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-12 rounded-md bg-muted/30 animate-pulse" />)}</div>
                ) : !profile || profile.visits.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No visits found.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <div className="overflow-x-auto">
                      <div className="min-w-[885px]">
                        <div className="grid grid-cols-[110px_80px_80px_90px_65px_90px_150px_80px_70px_65px] gap-x-2 px-3 py-2 bg-muted/40 border-b text-xs font-medium text-muted-foreground">
                          <span>Date</span><span>Signed In</span><span>Signed Out</span><span>Purpose</span><span>Citizen?</span><span>ACE POC</span><span>Email</span><span>Status</span><span>Duration</span><span>Source</span>
                        </div>
                        <div className="divide-y max-h-96 overflow-y-auto">
                          {profile.visits.map(v => (
                            <div key={v.id} className="grid grid-cols-[110px_80px_80px_90px_65px_90px_150px_80px_70px_65px] gap-x-2 px-3 py-2.5 items-center text-xs" data-testid={`contact-visit-${v.id}`}>
                              <div className="font-medium text-foreground whitespace-nowrap">{new Date(v.signedInAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                              <div className="text-muted-foreground whitespace-nowrap">{new Date(v.signedInAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
                              <div className="text-muted-foreground whitespace-nowrap">{v.signedOutAt ? new Date(v.signedOutAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}</div>
                              <div className="truncate text-muted-foreground">{v.purpose || "—"}</div>
                              <div className="text-muted-foreground">{v.usCitizen || "—"}</div>
                              <div className="truncate text-muted-foreground">{v.acePoc || "—"}</div>
                              <div className="truncate text-muted-foreground">{v.email || "—"}</div>
                              <div>{v.signedOutAt
                                ? <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 text-[10px] px-1.5 py-0 whitespace-nowrap">Signed out</Badge>
                                : <Badge variant="outline" className="text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-[10px] px-1.5 py-0 whitespace-nowrap">Signed in</Badge>
                              }</div>
                              <div className="text-muted-foreground whitespace-nowrap">{formatDuration(v.signedInAt, v.signedOutAt)}</div>
                              <div>{sourceBadge(v.source)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {profileSelected.notes && (
                  <div className="pt-2 space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Notes (this visit)</div>
                    <p className="text-sm">{profileSelected.notes}</p>
                  </div>
                )}
              </div>
              {/* Merge history */}
              {contactsMergeEvents.length > 0 && (
                <div className="space-y-2 pt-4 border-t mt-4">
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Merge history</span>
                  </div>
                  <div className="rounded-md border divide-y">
                    {contactsMergeEvents.map(ev => (
                      <div key={ev.id} className="px-3 py-2.5 text-xs space-y-0.5" data-testid={`contacts-merge-event-${ev.id}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{ev.secondaryName}</span>
                          {ev.secondaryEmail && (
                            <span className="text-muted-foreground">{ev.secondaryEmail}</span>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">
                            {ev.visitsMoved} visit{ev.visitsMoved !== 1 ? "s" : ""} absorbed
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {new Date(ev.mergedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" at "}
                          {new Date(ev.mergedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-4 border-t mt-4">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Internal notes</span>
                  <span className="text-xs text-muted-foreground ml-auto">Only visible to your team</span>
                </div>
                {notesLoading ? (
                  <div className="h-20 rounded-md bg-muted/30 animate-pulse" />
                ) : (
                  <Textarea
                    placeholder="Add notes for your team about this visitor…"
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    className="resize-none text-sm"
                    rows={3}
                    data-testid="textarea-contacts-visitor-notes"
                  />
                )}
                <Button
                  size="sm"
                  disabled={saveNotesMutation.isPending || notesLoading}
                  onClick={() => { if (notesLookupKey) saveNotesMutation.mutate({ key: notesLookupKey, notes: notesDraft }); }}
                  data-testid="button-save-contacts-visitor-notes"
                >
                  {saveNotesMutation.isPending ? "Saving…" : "Save notes"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Merge dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={open => { setMergeDialogOpen(open); if (!open) setMergePickedPrimary(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Merge contacts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Choose which contact to keep. All visits from the other contact will be moved here, then it will be removed.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {checkedContacts.map(c => (
                <button
                  key={c.lookupKey}
                  type="button"
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${mergePickedPrimary === c.lookupKey ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}
                  onClick={() => setMergePickedPrimary(c.lookupKey)}
                  data-testid={`button-pick-primary-${c.lookupKey}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      {c.photoData ? (
                        <img src={c.photoData} alt={c.fullName} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(c.fullName).toUpperCase()}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{c.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.email || "—"}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {c.company && <div className="truncate">{c.company}</div>}
                    <div>{c.totalVisits} visit{c.totalVisits !== 1 ? "s" : ""}</div>
                  </div>
                  {mergePickedPrimary === c.lookupKey && (
                    <Badge className="mt-2 text-xs">Keep this one</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMergeDialogOpen(false)} disabled={mergeMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmMerge}
              disabled={!mergePickedPrimary || mergeMutation.isPending}
              data-testid="button-confirm-merge"
            >
              {mergeMutation.isPending ? "Merging…" : "Merge contacts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit contact dialog */}
      <Dialog open={editDialogOpen} onOpenChange={open => { setEditDialogOpen(open); if (!open) setEditContact(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Full name"
                data-testid="input-edit-contact-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="email@example.com"
                data-testid="input-edit-contact-email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                value={editCompany}
                onChange={e => setEditCompany(e.target.value)}
                placeholder="Company name"
                data-testid="input-edit-contact-company"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-phone">Phone #</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                data-testid="input-edit-contact-phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)} disabled={editMutation.isPending}>
              Cancel
            </Button>
            <Button
              disabled={editMutation.isPending || !editName.trim()}
              onClick={() => {
                if (!editContact) return;
                editMutation.mutate({
                  lookupKey: editContact.lookupKey,
                  fullName: editName.trim(),
                  email: editEmail.trim(),
                  company: editCompany.trim(),
                  phoneNumber: editPhone.trim(),
                });
              }}
              data-testid="button-save-edit-contact"
            >
              {editMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={open => { setDeleteConfirmOpen(open); if (!open) setDeleteContact(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteContact?.fullName}</strong> and all their visit records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} data-testid="button-cancel-delete-contact">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => { if (deleteContact) deleteMutation.mutate(deleteContact.lookupKey); }}
              data-testid="button-confirm-delete-contact"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete contact"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Export Data Tab ───────────────────────────────────────────────────────────

function ExportDataTab() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const { data: visitors = [] } = useQuery<Visitor[]>({ queryKey: ["/api/visitors"] });

  const dateRange = (() => {
    if (visitors.length === 0) return null;
    const dates = visitors.map((v) => new Date(v.signedInAt).getTime());
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return min.toDateString() === max.toDateString() ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  })();

  const exportVisitorsXlsx = async () => {
    setExporting(true);
    try {
      const XLSX = (await import("xlsx")).default;
      const headers = ["Full Name", "Email", "Company", "ACE POC", "Signed In", "Signed Out", "Duration", "US Citizen", "Purpose", "Location", "Source"];
      const rows = visitors.map((v) => [
        v.fullName,
        v.email ?? "",
        v.company ?? "",
        v.acePoc ?? "",
        new Date(v.signedInAt).toLocaleString(),
        v.signedOutAt ? new Date(v.signedOutAt).toLocaleString() : "",
        formatDuration(v.signedInAt, v.signedOutAt),
        v.usCitizen ?? "",
        v.purpose ?? "",
        v.location ?? "",
        v.source,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const colWidths = headers.map((h, i) => {
        const maxLen = Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length));
        return { wch: Math.min(maxLen + 2, 40) };
      });
      ws["!cols"] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Visitor Log");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `visitor-log-${date}.xlsx`);
      toast({ title: "Exported", description: `${visitors.length} visitor${visitors.length !== 1 ? "s" : ""} exported to Excel.` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Download visitor records as an Excel file for use in spreadsheets or other tools.
      </p>
      <Card>
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg p-2 bg-muted shrink-0">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Visitor Log</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {visitors.length} record{visitors.length !== 1 ? "s" : ""}
                {dateRange && <span className="ml-1">· {dateRange}</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Columns: Full Name, Email, Company, ACE POC, Signed In, Signed Out, Duration, US Citizen, Purpose, Location, Source
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={exportVisitorsXlsx}
            disabled={exporting || visitors.length === 0}
            data-testid="button-export-visitors"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {exporting ? "Exporting…" : "Download Excel"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Email list editor (shared by per-POC and global notification sections) ──

const ACE_DOMAIN = "@aceelectronics.com";

function isValidAceEmail(email: string): boolean {
  return /^[^\s@]+@aceelectronics\.com$/i.test(email.trim());
}

function EmailListEditor({
  emails,
  onSave,
  isSaving,
  testIdPrefix,
}: {
  emails: string[];
  onSave: (emails: string[]) => void;
  isSaving: boolean;
  testIdPrefix: string;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [localEmails, setLocalEmails] = useState<string[]>(emails);

  useEffect(() => {
    setLocalEmails(emails);
  }, [emails]);

  const handleAdd = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !isValidAceEmail(trimmed) || localEmails.includes(trimmed)) return;
    const updated = [...localEmails, trimmed];
    setLocalEmails(updated);
    setNewEmail("");
    onSave(updated);
  };

  const handleRemove = (email: string) => {
    const updated = localEmails.filter((e) => e !== email);
    setLocalEmails(updated);
    onSave(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
  };

  const isInvalid = newEmail.trim() !== "" && !isValidAceEmail(newEmail.trim());

  return (
    <div className="space-y-2 pt-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder={`name${ACE_DOMAIN}`}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            className={isInvalid ? "border-destructive" : ""}
            data-testid={`${testIdPrefix}-email-input`}
          />
          {isInvalid && (
            <p className="text-xs text-destructive mt-1">Must be an @aceelectronics.com address</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newEmail.trim() || isInvalid || isSaving}
          data-testid={`${testIdPrefix}-email-add`}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>
      {localEmails.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No notification emails configured.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {localEmails.map((email) => (
            <Badge
              key={email}
              variant="secondary"
              className="flex items-center gap-1 pr-1 text-xs"
              data-testid={`${testIdPrefix}-email-badge-${email}`}
            >
              {email}
              <button
                className="ml-0.5 rounded-full hover:text-destructive focus:outline-none"
                onClick={() => handleRemove(email)}
                disabled={isSaving}
                data-testid={`${testIdPrefix}-email-remove-${email}`}
                aria-label={`Remove ${email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ACE POC Tab ─────────────────────────────────────────────────────────────

function AcePocTab() {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [expandedPocId, setExpandedPocId] = useState<string | null>(null);
  const [savingEmailsFor, setSavingEmailsFor] = useState<string | null>(null);

  const { data: pocs = [], isLoading } = useQuery<AcePoc[]>({
    queryKey: ["/api/ace-pocs"],
  });

  const { data: notifData, isLoading: notifLoading } = useQuery<{ emails: string[] }>({
    queryKey: ["/api/notification-emails"],
  });

  const addMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/ace-pocs", { name }),
    onSuccess: () => {
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["/api/ace-pocs"] });
      toast({ title: "POC added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add", description: err.message ?? "An error occurred", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ace-pocs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ace-pocs"] });
      toast({ title: "POC removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove POC", variant: "destructive" });
    },
  });

  const updatePocEmailsMutation = useMutation({
    mutationFn: ({ id, emails }: { id: string; emails: string[] }) =>
      apiRequest("PATCH", `/api/ace-pocs/${id}/emails`, { emails }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ace-pocs"] });
      toast({ title: "Notification emails updated" });
    },
    onError: () => {
      toast({ title: "Failed to update emails", variant: "destructive" });
    },
    onSettled: () => setSavingEmailsFor(null),
  });

  const updateNotifEmailsMutation = useMutation({
    mutationFn: (emails: string[]) =>
      apiRequest("PATCH", "/api/notification-emails", { emails }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-emails"] });
      toast({ title: "Global notification emails updated" });
    },
    onError: () => {
      toast({ title: "Failed to update global emails", variant: "destructive" });
    },
  });

  const handlePocEmailSave = (pocId: string, emails: string[]) => {
    setSavingEmailsFor(pocId);
    updatePocEmailsMutation.mutate({ id: pocId, emails });
  };

  return (
    <div className="space-y-6">
      {/* Add new POC */}
      <div className="flex gap-2">
        <Input
          placeholder="Enter full name (e.g. Jane Smith)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) addMutation.mutate(newName.trim());
          }}
          data-testid="input-ace-poc-name"
        />
        <Button
          onClick={() => addMutation.mutate(newName.trim())}
          disabled={!newName.trim() || addMutation.isPending}
          data-testid="button-add-ace-poc"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </Button>
      </div>

      {/* POC roster */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pocs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ACE POCs configured yet. Add one above.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {pocs.map((poc) => {
            const isExpanded = expandedPocId === poc.id;
            const pocEmails: string[] = poc.emails ?? [];
            return (
              <li key={poc.id} data-testid={`row-ace-poc-${poc.id}`}>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">{poc.name}</span>
                    {pocEmails.length > 0 && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {pocEmails.length} email{pocEmails.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setExpandedPocId(isExpanded ? null : poc.id)}
                      data-testid={`button-edit-ace-poc-${poc.id}`}
                      title="Edit notification emails"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(poc.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-ace-poc-${poc.id}`}
                      title="Remove POC"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t bg-muted/30">
                    <p className="text-xs text-muted-foreground pt-2 mb-1">
                      Notification emails for <strong>{poc.name}</strong> — notified when they are selected at check-in.
                    </p>
                    <EmailListEditor
                      emails={pocEmails}
                      onSave={(emails) => handlePocEmailSave(poc.id, emails)}
                      isSaving={savingEmailsFor === poc.id && updatePocEmailsMutation.isPending}
                      testIdPrefix={`poc-${poc.id}`}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Global notification emails */}
      <div className="rounded-md border">
        <div className="px-4 py-3 border-b bg-muted/40">
          <h3 className="text-sm font-semibold">Global Notification Emails</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            These addresses receive a notification for every check-in, regardless of which POC was selected.
          </p>
        </div>
        <div className="px-4 py-3">
          {notifLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <EmailListEditor
              emails={notifData?.emails ?? []}
              onSave={(emails) => updateNotifEmailsMutation.mutate(emails)}
              isSaving={updateNotifEmailsMutation.isPending}
              testIdPrefix="global-notif"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignInFlow() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sign-in Flow</h1>
        <p className="text-muted-foreground mt-1">
          Configure what visitors see and fill out on the kiosk during check-in.
        </p>
      </div>

      <Tabs defaultValue="fields">
        <TabsList className="mb-4">
          <TabsTrigger value="fields" data-testid="tab-sign-in-fields">
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Sign-in Fields
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-1.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="photo" data-testid="tab-photo">
            <Camera className="h-4 w-4 mr-1.5" />
            Photo
          </TabsTrigger>
          <TabsTrigger value="plus-one" data-testid="tab-plus-one">
            <Users className="h-4 w-4 mr-1.5" />
            Plus One
          </TabsTrigger>
          <TabsTrigger value="devices" data-testid="tab-devices">
            <Monitor className="h-4 w-4 mr-1.5" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="visitor-log" data-testid="tab-visitor-log">
            <UserCheck className="h-4 w-4 mr-1.5" />
            Visitor Log
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <BookUser className="h-4 w-4 mr-1.5" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="export-data" data-testid="tab-export-data">
            <Download className="h-4 w-4 mr-1.5" />
            Export Data
          </TabsTrigger>
          <TabsTrigger value="ace-pocs" data-testid="tab-ace-pocs">
            <UserCog className="h-4 w-4 mr-1.5" />
            ACE POC
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <CardTitle>Sign-in Fields</CardTitle>
              <CardDescription>Fields guests fill in when checking in at the kiosk.</CardDescription>
            </CardHeader>
            <CardContent>
              <SignInFieldsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Legal documents shown during kiosk check-in. Visitors must tap "I Agree" for each enabled document.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photo">
          <Card>
            <CardHeader>
              <CardTitle>Photo Capture</CardTitle>
              <CardDescription>Optionally capture a visitor photo during check-in using the kiosk camera.</CardDescription>
            </CardHeader>
            <CardContent>
              <PhotoTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plus-one">
          <Card>
            <CardHeader>
              <CardTitle>Plus One & Timeout</CardTitle>
              <CardDescription>Group size collection and inactivity auto-reset settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlusOneTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>Devices</CardTitle>
              <CardDescription>Live list of iPads and tablets currently running the kiosk.</CardDescription>
            </CardHeader>
            <CardContent>
              <DevicesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visitor-log">
          <Card>
            <CardHeader>
              <CardTitle>Visitor Log</CardTitle>
              <CardDescription>Walk-in visitors from the kiosk and Envoy imports. Click a row to see full details.</CardDescription>
            </CardHeader>
            <CardContent>
              <VisitorLogTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>One record per unique visitor. Select two to merge duplicate profiles.</CardDescription>
            </CardHeader>
            <CardContent>
              <ContactsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export-data">
          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>Download visitor log and event lead data as CSV files.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExportDataTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ace-pocs">
          <Card>
            <CardHeader>
              <CardTitle>ACE POC Roster</CardTitle>
              <CardDescription>Names that appear in the "ACE POC" dropdown on the kiosk sign-in form. Add or remove entries here.</CardDescription>
            </CardHeader>
            <CardContent>
              <AcePocTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
