import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authStore';
import { useRefreshExpenses } from '@/features/expenses/api';

/** One change often writes a few rows at once; refresh once for all of them. */
const SETTLE_MS = 300;

/**
 * Keeps this device current while someone else changes things: every
 * activity row addressed to you means your balances may have moved. Also
 * catches up when the app comes back to the foreground, since nothing is
 * heard while it's in the background.
 */
export function useLiveUpdates() {
  const userId = useUserId();
  const refresh = useRefreshExpenses();

  useEffect(() => {
    if (!userId) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, SETTLE_MS);
    };

    const channel = supabase
      .channel(`activity:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_recipients',
          filter: `user_id=eq.${userId}`,
        },
        schedule,
      )
      .subscribe();

    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        schedule();
      }
    });

    return () => {
      clearTimeout(timer);
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);
}
