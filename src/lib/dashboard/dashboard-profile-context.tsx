"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Profile } from "@/types/database";

interface DashboardProfileContextValue {
  userId: string;
  profile: Profile;
}

const DashboardProfileContext = createContext<DashboardProfileContextValue | null>(null);

export function DashboardProfileProvider({
  userId,
  profile,
  children,
}: DashboardProfileContextValue & { children: ReactNode }) {
  return (
    <DashboardProfileContext.Provider value={{ userId, profile }}>
      {children}
    </DashboardProfileContext.Provider>
  );
}

export function useDashboardProfile() {
  return useContext(DashboardProfileContext);
}
