import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { NativeAd } from 'react-native-google-mobile-ads';
import { useStyles, type Theme } from '@/app/theme';
import { Badge, Stack, Text } from '@/components';
import { adRequestOptions, adsModule, adUnitId, useAdsEnabled } from './ads';

/** Activity feed: an ad after every this many items. */
export const NATIVE_AD_EVERY = 10;
/** No ads in short feeds. */
export const NATIVE_AD_MIN_ITEMS = 5;

export type FeedEntry<T> =
  | { type: 'item'; item: T }
  | { type: 'ad'; key: string };

/** Interleaves ad slots into a feed: one after every NATIVE_AD_EVERY items. */
export function withAdSlots<T>(items: T[], ads: boolean): FeedEntry<T>[] {
  const out: FeedEntry<T>[] = [];
  items.forEach((item, i) => {
    out.push({ type: 'item', item });
    if (
      ads &&
      items.length >= NATIVE_AD_MIN_ITEMS &&
      (i + 1) % NATIVE_AD_EVERY === 0
    ) {
      out.push({ type: 'ad', key: `ad-${i + 1}` });
    }
  });
  return out;
}

/** A native ad laid out like an activity row, clearly marked "Ad". */
export function NativeAdRow() {
  const styles = useStyles(createStyles);
  const enabled = useAdsEnabled();
  const [ad, setAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    const m = adsModule();
    if (!enabled || !m) {
      return;
    }
    let alive = true;
    let created: NativeAd | null = null;
    m.NativeAd.createForAdRequest(adUnitId('native'), adRequestOptions())
      .then(loaded => {
        created = loaded;
        if (alive) {
          setAd(loaded);
        } else {
          loaded.destroy();
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      created?.destroy();
    };
  }, [enabled]);

  const m = adsModule();
  if (!enabled || !m || !ad) {
    return null;
  }
  const { NativeAdView, NativeAsset, NativeAssetType } = m;
  return (
    <NativeAdView nativeAd={ad} style={styles.row} testID="ad-native">
      {ad.icon ? (
        <NativeAsset assetType={NativeAssetType.ICON}>
          <Image source={{ uri: ad.icon.url }} style={styles.icon} />
        </NativeAsset>
      ) : (
        <View style={styles.icon} />
      )}
      <Stack style={styles.body} gap="xxs">
        <View style={styles.headlineRow}>
          <Badge label="Ad" tone="neutral" />
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text numberOfLines={1} style={styles.headline}>
              {ad.headline}
            </Text>
          </NativeAsset>
        </View>
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {ad.body}
          </Text>
        </NativeAsset>
      </Stack>
      {ad.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text variant="bodyStrong" color="primary">
            {ad.callToAction}
          </Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      backgroundColor: t.colors.surface,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.colors.primarySoft,
    },
    body: { flex: 1 },
    headlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
    },
    headline: { flexShrink: 1 },
  });
