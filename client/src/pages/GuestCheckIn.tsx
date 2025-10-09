import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Phone, User, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GuestCheckIn() {
  const [step, setStep] = useState<"lookup" | "details" | "success">("lookup");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [checkInMethod, setCheckInMethod] = useState<"phone" | "email">("email");
  const { toast } = useToast();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/check-in/phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      if (response.ok) {
        const customer = await response.json();
        setCustomerName(customer.name);
        setStep("success");
        toast({
          title: "Checked In Successfully!",
          description: `Welcome, ${customer.name}!`,
        });
      } else {
        setStep("details");
      }
    } catch (error) {
      console.error('Check-in failed:', error);
      setStep("details");
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch(`/api/check-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail })
      });

      if (response.ok) {
        const customer = await response.json();
        setCustomerName(customer.name);
        setStep("success");
        toast({
          title: "Checked In Successfully!",
          description: `Welcome, ${customer.name}!`,
        });
      } else {
        setStep("details");
      }
    } catch (error) {
      console.error('Check-in failed:', error);
      setStep("details");
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch('/api/guest-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          email: normalizedEmail, 
          phone: phone || undefined, 
          status: 'checked-in' 
        })
      });

      if (response.ok) {
        const customer = await response.json();
        setCustomerName(customer.name);
        setStep("success");
        toast({
          title: "Registered & Checked In!",
          description: `Welcome, ${customer.name}!`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to register. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Failed to register and check in:', error);
      toast({
        title: "Error",
        description: "Failed to register. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {step === "lookup" && (
          <Card>
            <CardHeader>
              <CardTitle>Check-In</CardTitle>
              <CardDescription>
                Enter your phone number or email address to check in
              </CardDescription>
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
                    <Button type="submit" className="w-full" data-testid="button-submit-phone">
                      Continue
                    </Button>
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
                    <Button type="submit" className="w-full" data-testid="button-submit-email">
                      Continue
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {step === "details" && (
          <Card>
            <CardHeader>
              <CardTitle>Guest Registration</CardTitle>
              <CardDescription>
                We couldn't find your information. Please provide your details to check in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDetailsSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guest-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="guest-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="pl-10"
                      required
                      data-testid="input-guest-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="guest-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="pl-10"
                      required
                      data-testid="input-guest-email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-phone">Phone Number (Optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="guest-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="pl-10"
                      data-testid="input-guest-phone"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" data-testid="button-submit-details">
                  Check In
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "success" && (
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4">
                <CheckCircle className="h-16 w-16 text-chart-2" />
              </div>
              <CardTitle className="text-2xl">Welcome!</CardTitle>
              <CardDescription className="text-lg">
                You have been successfully checked in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold mb-4" data-testid="text-welcome-name">
                {customerName}
              </p>
              <p className="text-muted-foreground">
                You're all set. Enjoy your visit!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
