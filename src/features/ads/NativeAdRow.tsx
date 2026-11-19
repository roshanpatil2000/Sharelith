import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { NativeAd } from 'react-native-google-mobile-ads';
import { useStyles, type Theme } from '@/app/theme';
import { Badge, Stack, Text } from '@/components';
import { adRequestOptions, adsModule, adUnitId, useAdsEnabled } from './ads';

/**
 * Where ads go in a list: after item `first`, then every `every` items.
 * `endIfShort`: a list shorter than `first` gets one ad at the end.
 */
export type AdSpacing = {
  first: number;
  every: number;
  minItems: number;
  endIfShort?: boolean;
};

/** Activity feed: after the 10th item, then every 10; none under 5 items. */
export const FEED_AD_SPACING: AdSpacing = { first: 10, every: 10, minItems: 5 };
/**
 * Groups and Friends: short lists, so after the 3rd item, then every 8; a
 * list of one or two gets the ad at the end.
 */
export const LIST_AD_SPACING: AdSpacing = {
  first: 3,
  every: 8,
  minItems: 1,
  endIfShort: true,
};

/** Activity feed: an ad after every this many items. */
export const NATIVE_AD_EVERY = FEED_AD_SPACING.every;

export type FeedEntry<T> =
  | { type: 'item'; item: T }
  | { type: 'ad'; key: string };

/** Interleaves ad slots into a list, spaced as given. */
export function withAdSlots<T>(
  items: T[],
  ads: boolean,
  spacing: AdSpacing = FEED_AD_SPACING,
): FeedEntry<T>[] {
  const out: FeedEntry<T>[] = [];
  items.forEach((item, i) => {
    out.push({ type: 'item', item });
    const n = i + 1;
    if (
      ads &&
      items.length >= spacing.minItems &&
      n >= spacing.first &&
      (n - spacing.first) % spacing.every === 0
    ) {
      out.push({ type: 'ad', key: `ad-${n}` });
    }
  });
  if (
    ads &&
    spacing.endIfShort &&
    items.length >= spacing.minItems &&
    items.length < spacing.first
  ) {
    out.push({ type: 'ad', key: 'ad-end' });
  }
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
