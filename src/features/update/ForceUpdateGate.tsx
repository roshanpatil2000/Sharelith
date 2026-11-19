import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import { Download } from 'lucide-react-native';
import { EmptyState, Screen } from '@/components';
import {
  appVersion,
  isOlderVersion,
  loadRemoteConfig,
  useRemoteConfig,
} from '@/lib/remoteConfig';

/**
 * Blocks builds older than Remote Config's min_supported_version, so a
 * broken build can be retired without waiting for people to update.
 */
export function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const minimum = useRemoteConfig(s => s.min_supported_version);
  const updateUrl = useRemoteConfig(s => s.update_url);

  const blocked = isOlderVersion(appVersion, minimum);

  useEffect(() => {
    loadRemoteConfig();
  }, []);

  // The navigator normally hides the splash; it isn't shown when blocked.
  useEffect(() => {
    if (blocked) {
      BootSplash.hide({ fade: true }).catch(() => {});
    }
  }, [blocked]);

  if (!blocked) {
    return <>{children}</>;
  }
  return (
    <Screen padded>
      <EmptyState
        icon={Download}
        title="Please update Sharelith"
        message={`This version (${appVersion}) is no longer supported. Install the latest version to keep going.`}
        actionLabel="Update"
        onAction={() => Linking.openURL(updateUrl)}
      />
    </Screen>
  );
}
