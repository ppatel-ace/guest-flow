import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export function SplitScreen() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
    }, 800);
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-white text-slate-900 font-sans">
      {/* Left Panel */}
      <div className="relative flex flex-col justify-center bg-slate-900 text-white p-8 md:p-12 md:w-1/3 lg:w-2/5 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6 md:mb-12">
            <ShieldCheck className="h-10 w-10 text-blue-500" />
            <span className="text-xl md:text-2xl font-bold tracking-tight">Ace Electronics</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-white">
            Welcome to our facility.
          </h1>
          <p className="text-slate-400 text-lg max-w-sm">
            Defense Systems Division. Please check in to notify your point of contact.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 items-center justify-center p-8 md:p-12 lg:p-24 bg-slate-50">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-slate-100">
          {isSuccess ? (
            <div className="text-center py-12 animate-in fade-in zoom-in duration-500">
              <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You're checked in!</h2>
              <p className="text-slate-500">
                Your point of contact has been notified and will be with you shortly.
              </p>
              <Button 
                variant="outline" 
                className="mt-8"
                onClick={() => setIsSuccess(false)}
              >
                Check in another guest
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-1">Guest Check-In</h2>
                <p className="text-slate-500 text-sm">Please provide your details below.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Honeypot */}
                <div aria-hidden="true" className="hidden">
                  <input type="text" name="hp_field" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <select 
                      id="title" 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      <option value="mr">Mr.</option>
                      <option value="ms">Ms.</option>
                      <option value="mrs">Mrs.</option>
                      <option value="dr">Dr.</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                    <Input id="firstName" required placeholder="Jane" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                  <Input id="lastName" required placeholder="Doe" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                    <Input id="email" type="email" required placeholder="jane@example.com" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                    <Input id="phone" type="tel" required placeholder="(555) 123-4567" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company (Optional)</Label>
                  <Input id="company" placeholder="Organization name" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="poc">Ace POC (Optional)</Label>
                  <select 
                    id="poc" 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select your point of contact...</option>
                    <option value="john">John Smith - Engineering</option>
                    <option value="sarah">Sarah Connor - Security</option>
                    <option value="michael">Michael Johnson - HR</option>
                  </select>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4 h-11 text-base"
                  disabled={isLoading}
                >
                  {isLoading ? "Checking in..." : "Check In"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
