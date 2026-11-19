import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import { adRequestOptions, adsModule, adUnitId, useAdsEnabled } from './ads';

/**
 * One anchored adaptive banner, for the bottom of list screens. Never use
 * it on forms (adding an expense, settling up, signing in).
 */
export function AdBanner() {
  const styles = useStyles(createStyles);
  const enabled = useAdsEnabled();
  const [failed, setFailed] = useState(false);
  const m = adsModule();
  if (!enabled || !m || failed) {
    return null;
  }
  const { BannerAd, BannerAdSize } = m;
  return (
    <View style={styles.wrap} testID="ad-banner">
      <BannerAd
        unitId={adUnitId('banner')}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={adRequestOptions()}
        onAdFailedToLoad={() => setFailed(true)}
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
