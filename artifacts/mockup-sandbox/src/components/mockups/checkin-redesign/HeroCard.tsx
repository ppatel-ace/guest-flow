import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Shield } from "lucide-react";
import "./_group.css";

export function HeroCard() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate network request
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1200);
  };

  return (
    <div className="min-h-screen hero-gradient hero-bg-pattern flex flex-col items-center justify-center p-4 md:p-8 font-sans text-slate-900">
      <div className="w-full max-w-xl flex flex-col items-center mb-8 text-center">
        <div className="bg-slate-800/50 p-3 rounded-2xl mb-4 backdrop-blur-sm border border-slate-700/50">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
          Ace Electronics Defense Systems
        </h1>
        <p className="text-slate-400 text-lg">Secure Facility Check-In</p>
      </div>

      <div className="w-full max-w-xl bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
        {isSubmitted ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">You're checked in.</h2>
            <p className="text-slate-500 text-lg max-w-sm">
              Welcome to Ace Electronics Defense Systems. Your host has been notified of your arrival.
            </p>
            <p className="text-sm text-slate-400 mt-8">Please wait in the reception area.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6">
            {/* Honeypot field */}
            <div className="absolute left-[-9999px]" aria-hidden="true">
              <label htmlFor="hp_field">Do not fill this out</label>
              <input type="text" name="hp_field" id="hp_field" tabIndex={-1} />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[100px_1fr_1fr] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Title</Label>
                  <Select name="title">
                    <SelectTrigger id="title" className="bg-slate-50 border-slate-200 focus:ring-blue-500">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mr">Mr.</SelectItem>
                      <SelectItem value="ms">Ms.</SelectItem>
                      <SelectItem value="mrs">Mrs.</SelectItem>
                      <SelectItem value="dr">Dr.</SelectItem>
                      <SelectItem value="prof">Prof.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-slate-600 text-xs font-semibold uppercase tracking-wider">First Name *</Label>
                  <Input 
                    id="firstName" 
                    required 
                    className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Last Name *</Label>
                  <Input 
                    id="lastName" 
                    required 
                    className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Email Address *</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Phone Number *</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    required 
                    className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Company (Optional)</Label>
                  <Input 
                    id="company" 
                    className="bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="poc" className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Host / Point of Contact</Label>
                  <Select name="poc">
                    <SelectTrigger id="poc" className="bg-slate-50 border-slate-200 focus:ring-blue-500">
                      <SelectValue placeholder="Select host..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sarah-j">Sarah Johnson - Engineering</SelectItem>
                      <SelectItem value="michael-c">Michael Chen - Security</SelectItem>
                      <SelectItem value="robert-w">Robert Williams - Operations</SelectItem>
                      <SelectItem value="emily-d">Emily Davis - HR</SelectItem>
                      <SelectItem value="other">Other / Not Listed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-8 border-t border-slate-100">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-medium shadow-lg shadow-blue-500/25 transition-all"
              >
                {isSubmitting ? "Verifying..." : "Complete Check-In"}
              </Button>
            </div>
          </form>
        )}
      </div>
      
      <div className="mt-8 text-slate-500 text-sm flex items-center gap-2">
        <Shield className="w-4 h-4" />
        <span>Confidential & Secured Facility</span>
      </div>
    </div>
  );
}
