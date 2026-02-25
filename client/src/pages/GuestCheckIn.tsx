import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Phone, User, Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import logoPath from "@assets/Blue AEDS_1760039355599.png";
import type { PageSettings } from "@shared/schema";

export default function GuestCheckIn() {
  const [step, setStep] = useState<"lookup" | "details" | "success">("lookup");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [checkInMethod, setCheckInMethod] = useState<"phone" | "email">("email");
  const { toast } = useToast();

  const { data: settings, isLoading: settingsLoading } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/guest_checkin_page"],
  });

  const title = settings?.title ?? "Check-In";
  const description = settings?.description ?? "Enter your phone number or email address to check in";
  const successMessage = settings?.successMessage ?? "You have been successfully checked in";

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/check-in/phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (response.ok) {
        const customer = await response.json();
        setCustomerName(customer.name);
        setStep("success");
        toast({ title: "Checked In Successfully!", description: `Welcome, ${customer.name}!` });
      } else {
        setStep("details");
      }
    } catch (error) {
      console.error("Check-in failed:", error);
      setStep("details");
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch(`/api/check-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (response.ok) {
        const customer = await response.json();
        setCustomerName(customer.name);
        setStep("success");
        toast({ title: "Checked In Successfully!", description: `Welcome, ${customer.name}!` });
      } else {
        setStep("details");
      }
    } catch (error) {
      console.error("Check-in failed:", error);
      setStep("details");
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch("/api/guest-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: normalizedEmail, phone: phone || undefined, status: "checked-in" }),
      });
      if (response.ok) {
        const customer = await response.json();
        setCustomerName(customer.name);
        setStep("success");
        toast({ title: "Registered & Checked In!", description: `Welcome, ${customer.name}!` });
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to register. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to register and check in:", error);
      toast({ title: "Error", description: "Failed to register. Please try again.", variant: "destructive" });
    }
  };

  const handleBack = () => {
    setStep("lookup");
    setName("");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-4 sm:space-y-6">
        <div className="flex justify-center">
          <a href="https://www.aceelectronics.com/" target="_blank" rel="noopener noreferrer" data-testid="link-logo">
            <img src={logoPath} alt="Ace Electronics Defense Systems" className="h-24 sm:h-28 md:h-32 lg:h-36 w-auto" data-testid="img-logo" />
          </a>
        </div>

        {step === "lookup" && (
          <Card>
            <CardHeader>
              {settingsLoading ? (
                <>
                  <Skeleton className="h-7 w-32 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </>
              ) : (
                <>
                  <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
                  <CardDescription className="text-sm sm:text-base">{description}</CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent>
              <Tabs
                value={checkInMethod}
                onValueChange={(v) => setCheckInMethod(v as "phone" | "email")}
                data-testid="tabs-check-in-method"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="phone" data-testid="tab-phone">Phone</TabsTrigger>
                  <TabsTrigger value="email" data-testid="tab-email">Email</TabsTrigger>
                </TabsList>
                <TabsContent value="phone">
                  <form onSubmit={handlePhoneSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="pl-10"
                          required
                          data-testid="input-phone-check-in"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" data-testid="button-submit-phone">Continue</Button>
                  </form>
                </TabsContent>
                <TabsContent value="email">
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-checkin">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email-checkin"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="john@example.com"
                          className="pl-10"
                          required
                          data-testid="input-email-check-in"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" data-testid="button-submit-email">Continue</Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {step === "details" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="icon" onClick={handleBack} type="button" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-xl sm:text-2xl">Guest Registration</CardTitle>
              </div>
              <CardDescription className="text-sm sm:text-base">
                We couldn't find your information. Please provide your details to check in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDetailsSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guest-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="guest-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="pl-10" required data-testid="input-guest-name" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="guest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="pl-10" required data-testid="input-guest-email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-phone">Phone Number (Optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="guest-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="pl-10" data-testid="input-guest-phone" />
                  </div>
                </div>
                <Button type="submit" className="w-full" data-testid="button-submit-details">Check In</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "success" && (
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4">
                <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-chart-2" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl">Welcome!</CardTitle>
              <CardDescription className="text-base sm:text-lg">{successMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg sm:text-xl font-semibold mb-4" data-testid="text-welcome-name">{customerName}</p>
              <p className="text-sm sm:text-base text-muted-foreground">You're all set. Enjoy your visit!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
