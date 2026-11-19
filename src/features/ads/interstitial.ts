import { useRemoteConfig } from '@/lib/remoteConfig';
import { storage } from '@/lib/storage';
import { adRequestOptions, adsModule, adUnitId, useAdsStore } from './ads';

const SAVES_KEY = 'ads.expenseSaves';
const LAST_SHOWN_KEY = 'ads.interstitialShownAt';

/**
 * Whether a new expense save may show an interstitial: never during the
 * first few saves, and at most once per few minutes.
 */
export function interstitialDue(
  saves: number,
  lastShownAt: number,
  now: number,
  afterSaves: number,
  minMinutes: number,
): boolean {
  return saves > afterSaves && now - lastShownAt >= minMinutes * 60_000;
}

type Loaded = { show: () => Promise<void> } | null;
let loaded: Loaded = null;
let loading = false;

/** Loads one interstitial in the background so it's ready when needed. */
export function preloadInterstitial(): void {
  const m = adsModule();
  if (!m || loaded || loading || !useAdsStore.getState().ready) {
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
 * Call after a new expense is saved. Shows the preloaded interstitial when
 * one is due; otherwise just counts the save.
 */
export async function afterExpenseSaved(adsEnabled: boolean): Promise<void> {
  const saves = (Number(storage.getString(SAVES_KEY)) || 0) + 1;
  storage.set(SAVES_KEY, String(saves));
  if (!adsEnabled) {
    return;
  }
  const { interstitial_after_saves, interstitial_min_minutes } =
    useRemoteConfig.getState();
  const lastShownAt = Number(storage.getString(LAST_SHOWN_KEY)) || 0;
  if (
    loaded &&
    interstitialDue(
      saves,
      lastShownAt,
      Date.now(),
      interstitial_after_saves,
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
