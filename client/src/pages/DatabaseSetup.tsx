import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function DatabaseSetup() {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [sqlData, setSqlData] = useState("");
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  const handleImportSQL = async () => {
    if (!sqlData.trim()) {
      toast({
        title: "No Data",
        description: "Please paste your SQL import data.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const result: any = await apiRequest('POST', '/api/setup/import-sql', { sql: sqlData });
      const inserted = result.inserted || 0;
      const skipped = result.skipped || 0;
      
      if (inserted === 0 && skipped > 0) {
        setImportResult({
          success: true,
          message: `All ${skipped} customers already exist in database (duplicates skipped)`,
          count: 0,
        });
        toast({
          title: "Already Imported",
          description: `All ${skipped} customers already exist. No new data was added.`,
        });
      } else if (inserted > 0 && skipped > 0) {
        setImportResult({
          success: true,
          message: `Imported ${inserted} customers, ${skipped} duplicates skipped`,
          count: inserted,
        });
        toast({
          title: "Partial Import",
          description: `Successfully imported ${inserted} customers. ${skipped} duplicates were skipped.`,
        });
      } else {
        setImportResult({
          success: true,
          message: `Successfully imported ${inserted} customers`,
          count: inserted,
        });
        toast({
          title: "Success",
          description: `Imported ${inserted} customers successfully!`,
        });
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        message: error.message || "Import failed",
      });
      toast({
        title: "Import Failed",
        description: error.message || "An error occurred during import.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleInitSchema = async () => {
    setImporting(true);
    setImportResult(null);

    try {
      const result: any = await apiRequest('POST', '/api/setup/init-schema');
      setImportResult({
        success: true,
        message: result.message || "Database schema initialized successfully",
      });
      toast({
        title: "Success",
        description: "Database schema initialized successfully!",
      });
    } catch (error: any) {
      setImportResult({
        success: false,
        message: error.message || "Schema initialization failed",
      });
      toast({
        title: "Failed",
        description: error.message || "An error occurred during initialization.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Database Setup</CardTitle>
          </div>
          <CardDescription>
            Initialize your production database schema and import customer data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Step 1: Initialize Database Schema</h3>
              <p className="text-sm text-muted-foreground mb-3">
                This will create the necessary tables and enums in your database.
              </p>
              <Button 
                onClick={handleInitSchema} 
                disabled={importing}
                data-testid="button-init-schema"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  "Initialize Schema"
                )}
              </Button>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Step 2: Import Customer Data</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Paste the SQL import statements from <code className="bg-muted px-1 rounded">production_import.sql</code> file below.
              </p>
              <Textarea
                placeholder="Paste SQL INSERT statements here..."
                value={sqlData}
                onChange={(e) => setSqlData(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                data-testid="textarea-sql-import"
              />
              <Button 
                onClick={handleImportSQL} 
                disabled={importing || !sqlData.trim()}
                className="mt-3"
                data-testid="button-import-sql"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import Data"
                )}
              </Button>
            </div>
          </div>

          {importResult && (
            <Alert variant={importResult.success ? "default" : "destructive"}>
              {importResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {importResult.message}
                {importResult.count !== undefined && ` (${importResult.count} customers)`}
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold">Instructions:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Click "Initialize Schema" to create database tables</li>
              <li>Open the <code className="bg-background px-1 rounded">production_import.sql</code> file from your workspace</li>
              <li>Copy all SQL INSERT statements</li>
              <li>Paste them in the text area above</li>
              <li>Click "Import Data" to import all customers</li>
              <li>Navigate to Invitations page to see your customer list</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
