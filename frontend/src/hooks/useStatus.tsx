import React, { createContext, useContext, useState, useCallback } from 'react';

export type ActivityStatus = "idle" | "running" | "success" | "error";

export interface Activity {
  id: string;            // unique identifier
  label: string;
  detail?: string;
  status: ActivityStatus;
  progress?: number;     // 0–100
  startAt?: number;
  endAt?: number;
}

interface StatusBarContextType {
  activities: Activity[];
  start: (a: Omit<Activity, "status" | "startAt">) => void;
  update: (id: string, patch: Partial<Activity>) => void;
  finish: (id: string, ok?: boolean) => void;
  clear: () => void;
}

const StatusBarContext = createContext<StatusBarContextType | null>(null);

export const StatusBarProvider = ({ children }: { children: React.ReactNode }) => {
  const [activities, setActivities] = useState<Activity[]>([]);

  const start = useCallback((a: Omit<Activity, "status" | "startAt">) => {
    setActivities(prev => [
      ...prev,
      {
        ...a,
        status: "running",
        startAt: Date.now(),
      }
    ]);
  }, []);

  const update = useCallback((id: string, patch: Partial<Activity>) => {
    setActivities(prev =>
      prev.map(a => (a.id === id ? { ...a, ...patch } : a))
    );
  }, []);

  const finish = useCallback((id: string, ok = true) => {
    setActivities(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, status: ok ? "success" : "error", endAt: Date.now(), progress: 100 }
          : a
      )
    );
  }, []);

  const clear = useCallback(() => {
    setActivities([]);
  }, []);

  return (
    <StatusBarContext.Provider value={{ activities, start, update, finish, clear }}>
      {children}
    </StatusBarContext.Provider>
  );
};

export const useStatusBar = () => {
  const ctx = useContext(StatusBarContext);
  if (!ctx) throw new Error("useStatusBar must be inside provider");
  return ctx;
};
