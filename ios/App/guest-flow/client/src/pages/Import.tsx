import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Import() {
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

  const handleImport = () => {
    if (file) {
      console.log('Importing file:', file.name);
      setFile(null);
    }
  };

  const handleDownloadTemplate = () => {
    console.log('Downloading CSV template');
  };

  return (
    <div className="space-y-6" data-testid="page-import">
      <div>
        <h1 className="text-3xl font-bold">Import Customers</h1>
        <p className="text-muted-foreground">Upload CSV or Excel files to add customers in bulk</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>
              Drag and drop your CSV or Excel file here
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              data-testid="dropzone-import-page"
            >
              {file ? (
                <div className="space-y-3">
                  <CheckCircle className="h-16 w-16 mx-auto text-chart-2" />
                  <p className="font-medium text-lg" data-testid="text-uploaded-filename">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <Button onClick={() => setFile(null)} variant="outline" data-testid="button-remove-file">
                    Remove File
                  </Button>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-base font-medium mb-2">
                    Drag and drop your file here
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Supports CSV, XLSX, and XLS files
                  </p>
                  <Button type="button" variant="outline" asChild>
                    <label htmlFor="file-upload-page" className="cursor-pointer" data-testid="button-browse-file">
                      <Upload className="mr-2 h-4 w-4" />
                      Browse Files
                      <input
                        id="file-upload-page"
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

            {file && (
              <Button onClick={handleImport} className="w-full" data-testid="button-import-file">
                <Upload className="mr-2 h-4 w-4" />
                Import Customers
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>File Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <AlertDescription>
                  Your file must include these columns:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>name</strong> - Customer full name</li>
                    <li><strong>email</strong> - Email address</li>
                    <li><strong>phone</strong> - Phone number</li>
                  </ul>
                </AlertDescription>
              </Alert>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleDownloadTemplate}
                data-testid="button-download-template"
              >
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example Format</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg font-mono text-xs overflow-x-auto">
                <div>name,email,phone</div>
                <div>John Doe,john@example.com,+1 (555) 123-4567</div>
                <div>Jane Smith,jane@example.com,+1 (555) 234-5678</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
