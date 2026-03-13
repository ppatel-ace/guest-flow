import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import logoPath from "@assets/Blue AEDS_1760039355599.png";
import type { PageSettings } from "@shared/schema";

const TITLE_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Other"];

const ACE_POC_OPTIONS = [
  "Jerry Parker",
  "Larry Pomasan",
  "Nish Patel",
  "Craig Frost",
  "Ashley Morris",
  "Sanjay Parimi",
];

export default function GuestCheckIn() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [customerName, setCustomerName] = useState("");
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [company, setCompany] = useState("");
  const [acePoc, setAcePoc] = useState("");

  const { data: settings, isLoading: settingsLoading } = useQuery<PageSettings>({
    queryKey: ["/api/page-settings/guest_checkin_page"],
  });

  const pageTitle = settings?.title ?? "Check-In";
  const description = settings?.description ?? "Please fill in your details to check in";
  const successTitle = settings?.successTitle ?? "Welcome!";
  const successMessage = settings?.successMessage ?? "You have been successfully checked in";
  const eventName = settings?.eventName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    try {
      const leadRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: normalizedEmail,
          phoneNumber: phoneNumber.trim(),
          company: company.trim() || null,
          acePoc: acePoc || null,
        }),
      });

      if (!leadRes.ok) {
        const err = await leadRes.json();
        toast({ title: "Error", description: err.error || "Failed to submit form.", variant: "destructive" });
        return;
      }

      const leadData = await leadRes.json();

      const checkInRes = await fetch("/api/guest-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email: normalizedEmail,
          phone: phoneNumber.trim() || undefined,
          status: "checked-in",
        }),
      });

      if (checkInRes.ok) {
        const customer = await checkInRes.json();
        setCustomerName(customer.name);
      } else {
        const checkInByEmail = await fetch("/api/check-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        });
        if (checkInByEmail.ok) {
          const customer = await checkInByEmail.json();
          setCustomerName(customer.name);
        } else {
          setCustomerName(fullName);
        }
      }

      setStep("success");
    } catch (error) {
      console.error("Submission failed:", error);
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-4 sm:space-y-6">
        <div className="flex flex-col items-center gap-2">
          <a href="https://www.aceelectronics.com/" target="_blank" rel="noopener noreferrer" data-testid="link-logo">
            <img src={logoPath} alt="Ace Electronics Defense Systems" className="h-24 sm:h-28 md:h-32 w-auto" data-testid="img-logo" />
          </a>
          {settingsLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : eventName ? (
            <p className="text-base font-semibold text-center" data-testid="text-event-name">{eventName}</p>
          ) : null}
        </div>

        {step === "form" && (
          <Card>
            <CardHeader>
              {settingsLoading ? (
                <>
                  <Skeleton className="h-7 w-32 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </>
              ) : (
                <>
                  <CardTitle className="text-xl sm:text-2xl">{pageTitle}</CardTitle>
                  <CardDescription className="text-sm sm:text-base">{description}</CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title-select">Title</Label>
                  <Select value={title} onValueChange={setTitle}>
                    <SelectTrigger id="title-select" data-testid="select-title">
                      <SelectValue placeholder="Select title" />
                    </SelectTrigger>
                    <SelectContent>
                      {TITLE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="first-name">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    data-testid="input-first-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-name">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    data-testid="input-last-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="guest-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                    data-testid="input-guest-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone-number">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    required
                    data-testid="input-phone-number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">
                    Company <span className="text-muted-foreground text-xs">(Optional)</span>
                  </Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Corp"
                    data-testid="input-company"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ace-poc">
                    Ace POC <span className="text-muted-foreground text-xs">(Optional)</span>
                  </Label>
                  <Select value={acePoc} onValueChange={setAcePoc}>
                    <SelectTrigger id="ace-poc" data-testid="select-ace-poc">
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACE_POC_OPTIONS.map((poc) => (
                        <SelectItem key={poc} value={poc}>{poc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" data-testid="button-submit-lead">
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
                <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-chart-2" />
              </div>
              <CardTitle className="text-xl sm:text-2xl md:text-3xl">{successTitle}</CardTitle>
              <CardDescription className="text-base sm:text-lg">{successMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg sm:text-xl font-semibold mb-4" data-testid="text-welcome-name">
                {customerName}
              </p>
              <p className="text-sm sm:text-base text-muted-foreground">You're all set. Enjoy your visit!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
