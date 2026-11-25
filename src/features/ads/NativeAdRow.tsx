import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { NativeAd } from 'react-native-google-mobile-ads';
import { useStyles, type Theme } from '@/app/theme';
import { Badge, Stack, Text } from '@/components';
import { useRemoteConfig } from '@/lib/remoteConfig';
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

/**
 * Activity feed: after the 5th item, then every 6. A feed of 3 or 4 items
 * gets one at the end.
 */
export const FEED_AD_SPACING: AdSpacing = {
  first: 5,
  every: 6,
  minItems: 3,
  endIfShort: true,
};
/**
 * Groups and Friends: short lists, so after the 2nd item, then every 5; a
 * list of one gets the ad at the end.
 */
export const LIST_AD_SPACING: AdSpacing = {
  first: 2,
  every: 5,
  minItems: 1,
  endIfShort: true,
};

/** A list's spacing, with Remote Config able to tune where ads go. */
export function useAdSpacing(list: 'feed' | 'list'): AdSpacing {
  const first = useRemoteConfig(s =>
    list === 'feed' ? s.native_feed_first : s.native_list_first,
  );
  const every = useRemoteConfig(s =>
    list === 'feed' ? s.native_feed_every : s.native_list_every,
  );
  const base = list === 'feed' ? FEED_AD_SPACING : LIST_AD_SPACING;
  // Bad values from the console fall back to the defaults.
  return {
    ...base,
    first: first >= 1 ? Math.floor(first) : base.first,
    every: every >= 2 ? Math.floor(every) : base.every,
  };
}

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
