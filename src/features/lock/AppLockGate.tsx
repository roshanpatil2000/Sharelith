import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Button, Icon, Text } from '@/components';
import { useAuthStatus } from '@/features/auth/authStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { authenticate } from './biometrics';

/** Lock again after the app has been in the background this long. */
export const RELOCK_AFTER_MS = 30_000;

/**
 * Covers the app with a lock screen on launch and after returning from the
 * background, when the user has turned on app lock and is signed in.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const styles = useStyles(createStyles);
  const enabled = useSettingsStore(s => s.appLockEnabled);
  const signedIn = useAuthStatus() === 'signedIn';
  const [locked, setLocked] = useState(enabled);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) {
      return;
    }
    prompting.current = true;
    const ok = await authenticate('Unlock Sharelith');
    prompting.current = false;
    if (ok) {
      setLocked(false);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (
          useSettingsStore.getState().appLockEnabled &&
          away >= RELOCK_AFTER_MS
        ) {
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, []);

  const showLock = locked && enabled && signedIn;

  // Prompt straight away whenever the lock screen appears.
  useEffect(() => {
    if (showLock) {
      unlock();
    }
  }, [showLock, unlock]);

  return (
    <>
      {children}
      {showLock ? (
        <View style={styles.overlay} testID="app-lock">
          <View style={styles.iconWrap}>
            <Icon icon={Lock} size={36} color="primary" />
          </View>
          <Text variant="title">Sharelith is locked</Text>
          <Button title="Unlock" size="lg" onPress={unlock} />
        </View>
      ) : null}
    </>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFill,
      zIndex: t.zIndex.toast + 1,
      backgroundColor: t.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.lg,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
