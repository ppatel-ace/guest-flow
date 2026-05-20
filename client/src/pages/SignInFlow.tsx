import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import type { FormField, Customer, Lead, Visitor } from "@shared/schema";
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

// ─── Re-used from PublicPages: FormFieldsManager ──────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  email: "Email",
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

function VisitorLogTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Visitor | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allVisitors = [], isLoading, refetch } = useQuery<Visitor[]>({
    queryKey: ["/api/visitors"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/visitors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      setSelected(null);
      toast({ title: "Visitor removed" });
    },
  });

  const filtered = allVisitors.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.fullName.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.company?.toLowerCase().includes(q) ||
      false
    );
  });

  const handleEnvoyFile = async (file: File) => {
    setImporting(true);
    try {
      const Papa = (await import("papaparse")).default;
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) {
        toast({ title: "CSV parse error", description: parsed.errors[0].message, variant: "destructive" });
        setImporting(false);
        return;
      }
      const rows = parseEnvoyRows(parsed.data);
      const res = await apiRequest("POST", "/api/visitors/import", { rows });
      const result = await res.json();
      toast({ title: "Import complete", description: result.message });
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      setImportOpen(false);
    } catch (err: any) {
      toast({ title: "Import failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    }
    setImporting(false);
  };

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
        <span className="text-sm text-muted-foreground whitespace-nowrap flex-1">
          {isLoading ? "Loading…" : `${filtered.length} visitor${filtered.length !== 1 ? "s" : ""}`}
        </span>
        <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-refresh-visitors">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-envoy">
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Import Envoy CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading visitors…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center border border-dashed rounded-md space-y-2">
          <UserCheck className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {search ? "No visitors match your search." : "No kiosk check-ins yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-x-4 px-4 py-2 bg-muted/40 border-b text-xs font-medium text-muted-foreground">
            <span>Name / Email</span>
            <span>Company</span>
            <span>ACE POC</span>
            <span>Signed In</span>
            <span>Source</span>
          </div>
          <div className="divide-y">
            {filtered.map((visitor) => (
              <button
                key={visitor.id}
                className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors"
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
                <div className="flex-1 min-w-0 grid sm:grid-cols-[1fr_1fr_1fr] gap-x-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{visitor.fullName}</div>
                    <div className="text-xs text-muted-foreground truncate">{visitor.email || "—"}</div>
                  </div>
                  <div className="hidden sm:block text-sm text-muted-foreground truncate self-center">{visitor.company || "—"}</div>
                  <div className="hidden sm:block text-sm text-muted-foreground truncate self-center">{visitor.acePoc || "—"}</div>
                </div>
                <div className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {new Date(visitor.signedInAt).toLocaleDateString()}
                </div>
                <div className="shrink-0">{sourceBadge(visitor.source)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail sheet */}
      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle>Visitor Details</SheetTitle>
              </SheetHeader>
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  {selected.photoData ? (
                    <img src={selected.photoData} alt="Visitor photo" className="h-20 w-20 rounded-full object-cover border shrink-0" />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border">
                      <span className="text-2xl font-semibold text-primary">{getInitials(selected.fullName).toUpperCase()}</span>
                    </div>
                  )}
                  <div>
                    <div className="text-lg font-semibold">{selected.fullName}</div>
                    <div className="text-sm text-muted-foreground">{selected.email || "No email"}</div>
                    <div className="mt-1">{sourceBadge(selected.source)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selected.company && (<><span className="text-muted-foreground font-medium">Company</span><span>{selected.company}</span></>)}
                  {selected.acePoc && (<><span className="text-muted-foreground font-medium">ACE POC</span><span>{selected.acePoc}</span></>)}
                  {selected.purpose && (<><span className="text-muted-foreground font-medium">Purpose</span><span>{selected.purpose}</span></>)}
                  {selected.usCitizen && (<><span className="text-muted-foreground font-medium">US Citizen</span><span>{selected.usCitizen}</span></>)}
                  {selected.location && (<><span className="text-muted-foreground font-medium">Location</span><span>{selected.location}</span></>)}
                  <span className="text-muted-foreground font-medium">Signed In</span>
                  <span>{new Date(selected.signedInAt).toLocaleString()}</span>
                  {selected.signedOutAt && (<><span className="text-muted-foreground font-medium">Signed Out</span><span>{new Date(selected.signedOutAt).toLocaleString()}</span></>)}
                </div>

                {selected.notes && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Notes</div>
                    <p className="text-sm">{selected.notes}</p>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate(selected.id)}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-visitor"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Remove visitor
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Envoy import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Envoy CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Upload a visitor log exported from Envoy. Duplicate entries (same name + date) will be skipped automatically.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEnvoyFile(f); e.target.value = ""; }}
              data-testid="input-envoy-file"
            />
            <Button
              className="w-full"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              data-testid="button-choose-envoy-file"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importing ? "Importing…" : "Choose CSV file"}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing} data-testid="button-cancel-import">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Export Data Tab ───────────────────────────────────────────────────────────

function ExportDataTab() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const { data: visitors = [] } = useQuery<Visitor[]>({ queryKey: ["/api/visitors"] });
  const { data: leads = [] } = useQuery<Lead[]>({ queryKey: ["/api/leads"] });

  const downloadCsv = (filename: string, rows: string[][], headers: string[]) => {
    const lines = [headers, ...rows].map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportVisitors = () => {
    setExporting(true);
    const headers = ["Full Name", "Email", "Company", "ACE POC", "Signed In", "Signed Out", "Source", "US Citizen", "Purpose", "Location", "Notes"];
    const rows = visitors.map((v) => [
      v.fullName,
      v.email ?? "",
      v.company ?? "",
      v.acePoc ?? "",
      new Date(v.signedInAt).toLocaleString(),
      v.signedOutAt ? new Date(v.signedOutAt).toLocaleString() : "",
      v.source,
      v.usCitizen ?? "",
      v.purpose ?? "",
      v.location ?? "",
      v.notes ?? "",
    ]);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`visitor-log-${date}.csv`, rows, headers);
    toast({ title: "Exported", description: `${visitors.length} visitor${visitors.length !== 1 ? "s" : ""} exported.` });
    setExporting(false);
  };

  const exportLeads = () => {
    setExporting(true);
    const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "ACE POC", "Event", "Submitted At", "Plus One Count"];
    const rows = (leads as Lead[]).map((l) => [
      l.firstName,
      l.lastName,
      l.email,
      l.phoneNumber,
      l.company ?? "",
      l.acePoc ?? "",
      l.eventName ?? "",
      l.submittedAt ? new Date(l.submittedAt).toLocaleString() : "",
      String(l.plusOneCount ?? 0),
    ]);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`event-leads-${date}.csv`, rows, headers);
    toast({ title: "Exported", description: `${leads.length} lead${leads.length !== 1 ? "s" : ""} exported.` });
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Download data as CSV for use in spreadsheets or other tools.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2 bg-muted shrink-0">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Visitor Log</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {visitors.length} kiosk / Envoy walk-in{visitors.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={exportVisitors}
              disabled={exporting || visitors.length === 0}
              data-testid="button-export-visitors"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2 bg-muted shrink-0">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Event Leads</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {leads.length} guest check-in{leads.length !== 1 ? "s" : ""} from events
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={exportLeads}
              disabled={exporting || leads.length === 0}
              data-testid="button-export-leads"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
          <TabsTrigger value="export-data" data-testid="tab-export-data">
            <Download className="h-4 w-4 mr-1.5" />
            Export Data
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
      </Tabs>
    </div>
  );
}
