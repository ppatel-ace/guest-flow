import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportCustomersDialogProps {
  onImport?: (file: File) => void;
}

export function ImportCustomersDialog({ onImport }: ImportCustomersDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = () => {
    if (file) {
      onImport?.(file);
      setFile(null);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-import-customers">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Customers</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with customer data (name, email, phone).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            data-testid="dropzone-import"
          >
            {file ? (
              <div className="space-y-2">
                <CheckCircle className="h-12 w-12 mx-auto text-chart-2" />
                <p className="font-medium" data-testid="text-filename">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <>
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-2">
                  Drag and drop your file here
                </p>
                <p className="text-sm text-muted-foreground mb-4">or</p>
                <Button type="button" variant="outline" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer" data-testid="button-choose-file">
                    Choose File
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </Button>
              </>
            )}
          </div>
          
          <Alert>
            <AlertDescription>
              Your CSV should have columns: name, email, phone
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFile(null);
                setOpen(false);
              }}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!file}
              data-testid="button-submit-import"
            >
              Import Customers
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
