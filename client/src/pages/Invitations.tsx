import { useState, useRef, type ChangeEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomerStatusBadge } from "@/components/CustomerStatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Send, Phone, UserPlus, Upload, Download, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCustomerSchema } from "@shared/schema";
import type { Customer, InsertCustomer } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export default function Invitations() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const form = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      status: "pending",
    },
  });

  const editForm = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      status: "pending",
    },
  });

  const addCustomerMutation = useMutation({
    mutationFn: async (data: InsertCustomer) => {
      return apiRequest('POST', '/api/customers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Customer Added",
        description: "Customer has been added successfully.",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add customer.",
        variant: "destructive",
      });
    },
  });

  const importCustomersMutation = useMutation({
    mutationFn: async (customers: InsertCustomer[]) => {
      const promises = customers.map((customer, index) => 
        apiRequest('POST', '/api/customers', customer)
          .then(result => ({ status: 'fulfilled' as const, value: result, customer, index }))
          .catch(error => ({ status: 'rejected' as const, reason: error, customer, index }))
      );
      return Promise.all(promises);
    },
    onSuccess: (results, variables) => {
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      if (succeeded.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      }
      
      if (failed.length === 0) {
        toast({
          title: "Import Successful",
          description: `${succeeded.length} customer(s) imported successfully.`,
        });
        setIsImportDialogOpen(false);
      } else if (succeeded.length > 0) {
        const failedNames = failed.map(f => f.customer.name).slice(0, 3).join(', ');
        const moreCount = failed.length > 3 ? ` and ${failed.length - 3} more` : '';
        toast({
          title: "Partial Import",
          description: `${succeeded.length} imported, ${failed.length} failed. Failed: ${failedNames}${moreCount}. Likely duplicate emails.`,
          variant: "destructive",
        });
        setIsImportDialogOpen(false);
      } else {
        const failedNames = failed.map(f => f.customer.name).slice(0, 3).join(', ');
        const moreCount = failed.length > 3 ? ` and ${failed.length - 3} more` : '';
        toast({
          title: "Import Failed",
          description: `All ${failed.length} customer(s) failed. Failed: ${failedNames}${moreCount}. Check for duplicate emails or missing data.`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Import Error",
        description: "An unexpected error occurred during import.",
        variant: "destructive",
      });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return apiRequest('POST', `/api/customers/${customerId}/invite`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Invitation Sent",
        description: "The invitation has been sent successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send invitation.",
        variant: "destructive",
      });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCustomer> }) => {
      return apiRequest('PUT', `/api/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Customer Updated",
        description: "Customer details have been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedCustomer(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update customer.",
        variant: "destructive",
      });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({
        title: "Customer Deleted",
        description: "Customer has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedCustomer(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete customer.",
        variant: "destructive",
      });
    },
  });

  const handleSendInvite = (id: string) => {
    sendInviteMutation.mutate(id);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    editForm.reset({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
      status: customer.status,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteDialogOpen(true);
  };

  const onEditSubmit = (data: InsertCustomer) => {
    if (selectedCustomer) {
      updateCustomerMutation.mutate({ id: selectedCustomer.id, data });
    }
  };

  const confirmDelete = () => {
    if (selectedCustomer) {
      deleteCustomerMutation.mutate(selectedCustomer.id);
    }
  };

  const normalizeColumnName = (name: string): string => {
    return name.toLowerCase().trim();
  };

  const getFieldValue = (row: any, ...possibleNames: string[]): string => {
    for (const name of possibleNames) {
      const normalized = normalizeColumnName(name);
      // Check exact match first
      if (row[name] !== undefined && row[name] !== null) {
        return String(row[name]).trim();
      }
      // Check case-insensitive match
      const key = Object.keys(row).find(k => normalizeColumnName(k) === normalized);
      if (key && row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
    }
    return "";
  };

  const parseCSVWithEncoding = async (file: File, encodings: string[] = ['UTF-8', 'Windows-1252', 'ISO-8859-1']) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      let decodedText: string | null = null;
      let successfulEncoding: string | null = null;
      
      // Try each encoding until one works
      for (const encoding of encodings) {
        try {
          const decoder = new TextDecoder(encoding, { fatal: true });
          decodedText = decoder.decode(arrayBuffer);
          successfulEncoding = encoding;
          break;
        } catch (error) {
          // This encoding failed, try next one
          continue;
        }
      }
      
      if (!decodedText) {
        toast({
          title: "Encoding Error",
          description: "Unable to decode the CSV file. Please ensure it's saved with UTF-8, Windows-1252, or ISO-8859-1 encoding.",
          variant: "destructive",
        });
        return;
      }
      
      Papa.parse(decodedText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors);
          }
          
          const parsedCustomers = results.data
            .map((row: any) => {
              const name = getFieldValue(row, 'name', 'Name', 'NAME', 'Customer Name', 'Full Name');
              const email = getFieldValue(row, 'email', 'Email', 'EMAIL', 'Email Address', 'E-mail');
              const phone = getFieldValue(row, 'phone', 'Phone', 'PHONE', 'Phone Number', 'Mobile');
              
              return { name, email, phone };
            })
            .filter((customer) => customer.name && customer.email)
            .map((customer) => ({
              name: customer.name,
              email: customer.email.toLowerCase(),
              phone: customer.phone || "",
              status: "pending" as const,
            }));
          
          if (parsedCustomers.length > 0) {
            importCustomersMutation.mutate(parsedCustomers);
            if (successfulEncoding !== 'UTF-8') {
              toast({
                title: "Import Successful",
                description: `CSV imported successfully using ${successfulEncoding} encoding.`,
              });
            }
          } else {
            toast({
              title: "No Valid Data",
              description: "The CSV file contains no valid customer data. Please ensure your file has 'name' and 'email' columns with data.",
              variant: "destructive",
            });
          }
        },
        error: (error: Error) => {
          toast({
            title: "Parse Error",
            description: `Failed to parse CSV file: ${error.message}`,
            variant: "destructive",
          });
        },
      });
    };
    
    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "Unable to read the CSV file. Please try again.",
        variant: "destructive",
      });
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      parseCSVWithEncoding(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          const parsedCustomers = jsonData
            .map((row: any) => {
              const name = getFieldValue(row, 'name', 'Name', 'NAME', 'Customer Name', 'Full Name');
              const email = getFieldValue(row, 'email', 'Email', 'EMAIL', 'Email Address', 'E-mail');
              const phone = getFieldValue(row, 'phone', 'Phone', 'PHONE', 'Phone Number', 'Mobile');
              
              return { name, email, phone };
            })
            .filter((customer) => customer.name && customer.email)
            .map((customer) => ({
              name: customer.name,
              email: customer.email.toLowerCase(),
              phone: customer.phone || "",
              status: "pending" as const,
            }));
          
          if (parsedCustomers.length > 0) {
            importCustomersMutation.mutate(parsedCustomers);
          } else {
            toast({
              title: "No Valid Data",
              description: "The Excel file contains no valid customer data. Please ensure your file has 'name' and 'email' columns with data.",
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Parse Error",
            description: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            variant: "destructive",
          });
        }
      };
      reader.readAsBinaryString(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = (data: InsertCustomer) => {
    addCustomerMutation.mutate(data);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return "just now";
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return d.toLocaleDateString();
  };

  const downloadTemplate = () => {
    const templateData = [
      { name: 'John Doe', email: 'john@example.com', phone: '+1234567890' },
      { name: 'Jane Smith', email: 'jane@example.com', phone: '+0987654321' },
      { name: 'Bob Wilson', email: 'bob@example.com', phone: '' },
    ];

    const csvContent = [
      'name,email,phone',
      ...templateData.map(row => `${row.name},${row.email},${row.phone}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'customer-import-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded successfully. Fill it with your customer data and upload.",
    });
  };

  const exportToExcel = () => {
    const exportData = customers.map(customer => ({
      Name: customer.name,
      Email: customer.email,
      Phone: customer.phone,
      Status: customer.status,
      'QR Code': customer.qrCode || '',
      'Invited At': customer.invitedAt ? new Date(customer.invitedAt).toLocaleString() : '',
      'Checked In At': customer.checkedInAt ? new Date(customer.checkedInAt).toLocaleString() : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invitations');

    const fileName = `invitations-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Export Successful",
      description: `${customers.length} customer(s) exported to Excel.`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Invitations</h1>
          <p className="text-muted-foreground">Manage email invitations and QR codes</p>
        </div>
        <p className="text-muted-foreground">Loading invitations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-invitations">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Invitations</h1>
          <p className="text-muted-foreground">Manage email invitations and QR codes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-customer">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>
                  Enter customer details to add them to the invitation list.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} data-testid="input-customer-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} data-testid="input-customer-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="tel" 
                            placeholder="+1 (555) 000-0000" 
                            {...field} 
                            value={field.value || ""}
                            data-testid="input-customer-phone" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={addCustomerMutation.isPending} data-testid="button-submit-customer">
                      {addCustomerMutation.isPending ? "Adding..." : "Add Customer"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-import-file">
                <Upload className="mr-2 h-4 w-4" />
                Import File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Customers</DialogTitle>
                <DialogDescription>
                  Upload a CSV or Excel file with customer data. Required columns: name, email. Optional: phone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CSV or Excel (.xlsx, .xls) files
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  <div className="flex gap-2 justify-center mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importCustomersMutation.isPending}
                      data-testid="button-select-file"
                    >
                      {importCustomersMutation.isPending ? "Importing..." : "Select File"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={downloadTemplate}
                      data-testid="button-download-template"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Template
                    </Button>
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">File Format Example:</p>
                  <pre className="text-xs bg-background p-2 rounded">
{`name,email,phone
John Doe,john@example.com,+1234567890
Jane Smith,jane@example.com,`}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-2">Phone number is optional</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            onClick={exportToExcel}
            disabled={customers.length === 0}
            data-testid="button-export-excel"
          >
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>

          <Button data-testid="button-send-bulk-invites">
            <Send className="mr-2 h-4 w-4" />
            Send Bulk Invites
          </Button>
        </div>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer details below.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} data-testid="input-edit-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} data-testid="input-edit-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="tel" 
                        placeholder="+1 (555) 000-0000" 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-edit-phone" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateCustomerMutation.isPending} data-testid="button-update-customer">
                  {updateCustomerMutation.isPending ? "Updating..." : "Update Customer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer{selectedCustomer ? ` "${selectedCustomer.name}"` : ''} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteCustomerMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteCustomerMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4">
        {customers.map((customer) => (
          <Card key={customer.id} data-testid={`card-invitation-${customer.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(customer.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base" data-testid={`text-invitation-name-${customer.id}`}>{customer.name}</CardTitle>
                    <CardDescription data-testid={`text-invitation-email-${customer.id}`}>{customer.email}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CustomerStatusBadge status={customer.status} />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleSendInvite(customer.id)}
                    disabled={sendInviteMutation.isPending}
                    data-testid={`button-resend-${customer.id}`}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {customer.status === 'pending' ? 'Send' : 'Resend'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleEditCustomer(customer)}
                    data-testid={`button-edit-${customer.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleDeleteCustomer(customer)}
                    data-testid={`button-delete-${customer.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span data-testid={`text-phone-${customer.id}`}>{customer.phone}</span>
                </div>
                {customer.invitedAt && (
                  <div className="text-muted-foreground">
                    Sent: {formatDate(customer.invitedAt)}
                  </div>
                )}
                {customer.qrCode && (
                  <div className="text-muted-foreground">
                    QR Code: <span className="font-mono" data-testid={`text-qr-code-${customer.id}`}>{customer.qrCode}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
