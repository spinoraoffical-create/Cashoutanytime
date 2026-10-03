"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchUsersForAdmin, type AdminUserSearchResult } from "@/lib/actions/admin";
import { Loader2, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminUserSearchProps {
  onStartChat: (userId: string) => void;
  className?: string;
}

function displayUserContact(user: AdminUserSearchResult) {
  if (user.email && !user.email.endsWith("@phone.spinora.local")) return user.email;
  if (user.phone) return user.phone;
  if (user.whatsapp) return user.whatsapp;
  return "Phone user";
}

export function AdminUserSearch({ onStartChat, className }: AdminUserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const { users, error } = await searchUsersForAdmin(query);
      if (error) toast.error(error);
      setResults(users ?? []);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users by name, email, or phone..."
          className="pl-9 bg-[#1a1a1a] border-white/10"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">No users found.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1a1a] p-1">
          {results.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.full_name || "Unnamed user"}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {displayUserContact(user)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 h-8 text-xs gap-1 border-orange-500/30 hover:bg-orange-500/10"
                onClick={() => {
                  onStartChat(user.id);
                  setQuery("");
                  setResults([]);
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {user.conversationId ? "Open" : "Message"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
