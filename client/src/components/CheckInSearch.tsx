import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Phone, CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CheckInSearchProps {
  onCheckIn?: (customerId: string) => void;
}

interface SearchResult {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export function CheckInSearch({ onCheckIn }: CheckInSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  const mockResults: SearchResult[] = [
    { id: "1", name: "Sarah Johnson", email: "sarah.j@example.com", phone: "+1 (555) 123-4567" },
    { id: "2", name: "Michael Chen", email: "m.chen@example.com", phone: "+1 (555) 234-5678" },
  ];

  const handleSearch = () => {
    if (searchTerm) {
      setResults(mockResults.filter(r => 
        r.phone.includes(searchTerm) || r.name.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    } else {
      setResults([]);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card data-testid="card-check-in-search">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Phone Number Check-In
        </CardTitle>
        <CardDescription>
          Search by phone number to check in customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder="Enter phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            data-testid="input-phone-search"
          />
          <Button onClick={handleSearch} data-testid="button-search">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((result) => (
              <Card key={result.id} className="p-4" data-testid={`card-search-result-${result.id}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(result.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium" data-testid={`text-result-name-${result.id}`}>{result.name}</p>
                      <p className="text-sm text-muted-foreground" data-testid={`text-result-phone-${result.id}`}>{result.phone}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      onCheckIn?.(result.id);
                      setSearchTerm("");
                      setResults([]);
                    }}
                    data-testid={`button-check-in-result-${result.id}`}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Check In
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {searchTerm && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No customers found
          </p>
        )}
      </CardContent>
    </Card>
  );
}
