import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  adRequestOptions,
  adsModule,
  adUnitId,
  useAdsEnabled,
  useAdsStore,
} from './ads';

/**
 * One anchored adaptive banner, pinned below the tab bar (so never over a
 * form). It covers the bottom safe area itself once an ad has loaded.
 */
export function AdBanner() {
  const styles = useStyles(createStyles);
  const enabled = useAdsEnabled();
  const insets = useSafeAreaInsets();
  const loaded = useAdsStore(s => s.bannerLoaded);
  const [failed, setFailed] = useState(false);
  const m = adsModule();
  if (!enabled || !m || failed) {
    return null;
  }
  const { BannerAd, BannerAdSize } = m;
  return (
    <View
      style={[styles.wrap, loaded && { paddingBottom: insets.bottom }]}
      testID="ad-banner"
    >
      <BannerAd
        unitId={adUnitId('banner')}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={adRequestOptions()}
        onAdLoaded={() => useAdsStore.setState({ bannerLoaded: true })}
        onAdFailedToLoad={() => {
          setFailed(true);
          useAdsStore.setState({ bannerLoaded: false });
        }}
      />
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
  });
