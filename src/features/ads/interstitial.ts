import { useRemoteConfig } from '@/lib/remoteConfig';
import { storage } from '@/lib/storage';
import { adRequestOptions, adsModule, adUnitId, useAdsStore } from './ads';

const BREAKS_KEY = 'ads.breaks';
const LAST_SHOWN_KEY = 'ads.interstitialShownAt';

/**
 * Whether an ad break may show an interstitial: never during the first few
 * breaks, and at most once per few minutes.
 */
export function interstitialDue(
  breaks: number,
  lastShownAt: number,
  now: number,
  skipFirst: number,
  minMinutes: number,
): boolean {
  return breaks > skipFirst && now - lastShownAt >= minMinutes * 60_000;
}

type Loaded = { show: () => Promise<void> } | null;
let loaded: Loaded = null;
let loading = false;

/** Loads one interstitial in the background so it's ready when needed. */
export function preloadInterstitial(): void {
  const m = adsModule();
  const { ads_enabled, interstitial_enabled } = useRemoteConfig.getState();
  if (
    !m ||
    loaded ||
    loading ||
    !useAdsStore.getState().ready ||
    !ads_enabled ||
    !interstitial_enabled
  ) {
    return;
  }
  loading = true;
  const ad = m.InterstitialAd.createForAdRequest(
    adUnitId('interstitial'),
    adRequestOptions(),
  );
  const offLoaded = ad.addAdEventListener(m.AdEventType.LOADED, () => {
    loading = false;
    loaded = { show: () => ad.show() };
  });
  const offError = ad.addAdEventListener(m.AdEventType.ERROR, () => {
    loading = false;
    offLoaded();
    offError();
  });
  const offClosed = ad.addAdEventListener(m.AdEventType.CLOSED, () => {
    offLoaded();
    offError();
    offClosed();
    preloadInterstitial();
  });
  ad.load();
}

/**
 * Screens where moving to them is a natural break for a full-screen ad:
 * the main tabs and the detail screens. Never forms or sign-in.
 */
export const AD_BREAK_SCREENS = new Set([
  'Groups',
  'Friends',
  'Activity',
  'Account',
  'GroupDetail',
  'FriendDetail',
  'ExpenseDetail',
]);

/** Whether moving from one screen to another is an ad break. */
export function isAdBreak(from: string | undefined, to: string | undefined) {
  return !!from && !!to && from !== to && AD_BREAK_SCREENS.has(to);
}

/**
 * Counts an ad break (navigation, a saved expense) and shows the preloaded
 * interstitial when one is due: never in the first few breaks, and at most
 * once per few minutes, so it stays occasional.
 */
export async function maybeShowInterstitial(
  adsEnabled: boolean,
): Promise<void> {
  const breaks = (Number(storage.getString(BREAKS_KEY)) || 0) + 1;
  storage.set(BREAKS_KEY, String(breaks));
  if (!adsEnabled) {
    return;
  }
  const { interstitial_skip_first, interstitial_min_minutes } =
    useRemoteConfig.getState();
  const lastShownAt = Number(storage.getString(LAST_SHOWN_KEY)) || 0;
  if (
    loaded &&
    interstitialDue(
      breaks,
      lastShownAt,
      Date.now(),
      interstitial_skip_first,
      interstitial_min_minutes,
    )
  ) {
    const ad = loaded;
    loaded = null;
    storage.set(LAST_SHOWN_KEY, String(Date.now()));
    await ad.show().catch(() => {});
  } else {
    preloadInterstitial();
  }
}
