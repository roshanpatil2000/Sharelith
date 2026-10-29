import React, { useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ThemeProvider, useTheme } from '@/app/theme';
import { ToastHost } from '@/components';
import { queryClient, queryPersister } from '@/lib/queryClient';
import { startAuthListener } from '@/features/auth/authStore';
import { startAuthLinkListener } from '@/features/auth/authLinks';
import { AppLockGate } from '@/features/lock/AppLockGate';

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return (
    <StatusBar
      barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
    />
  );
}

/** Every app-wide provider, in dependency order. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => startAuthListener(), []);
  useEffect(() => startAuthLinkListener(), []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: queryPersister }}
          >
            <BottomSheetModalProvider>
              <ThemedStatusBar />
              <AppLockGate>{children}</AppLockGate>
              <ToastHost />
            </BottomSheetModalProvider>
          </PersistQueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
