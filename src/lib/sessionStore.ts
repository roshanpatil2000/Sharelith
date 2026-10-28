import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from './storage';

type SessionState = {
  /**
   * Phase 0 stand-in for real auth: lets developers enter the app shell.
   * Phase 1 replaces this with the Supabase session.
   */
  devSignedIn: boolean;
  signInDev: () => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    set => ({
      devSignedIn: false,
      signInDev: () => set({ devSignedIn: true }),
      signOut: () => set({ devSignedIn: false }),
    }),
    {
      name: 'session',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
