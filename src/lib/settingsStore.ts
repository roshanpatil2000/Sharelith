import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
};

/** Device-local UI preferences (not synced to the server). */
export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      themePreference: 'system',
      setThemePreference: themePreference => set({ themePreference }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
