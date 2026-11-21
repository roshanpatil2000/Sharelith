import { Platform } from 'react-native';
import { create } from 'zustand';
import { env } from '@/lib/env';
import { useRemoteConfig } from '@/lib/remoteConfig';
import { useIsPro } from '@/features/pro/pro';

/**
 * Google AdMob, Android only for now. Ads load only after Google's consent
 * flow (UMP) says they may, and only in the free version.
 */
type AdsModule = typeof import('react-native-google-mobile-ads');

export function adsModule(): AdsModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    return require('react-native-google-mobile-ads');
  } catch {
    return null;
  }
}

type AdsState = {
  /** Consent gathered and the SDK started: ads may be requested. */
  ready: boolean;
  /** The person agreed to personalised ads. */
  personalised: boolean;
  /** The law requires a way to change consent (shows "Ad choices"). */
  privacyOptionsRequired: boolean;
};

export const useAdsStore = create<AdsState>(() => ({
  ready: false,
  personalised: false,
  privacyOptionsRequired: false,
}));

/** Whether to show any ads right now. */
export function useAdsEnabled(): boolean {
  const remote = useRemoteConfig(s => s.ads_enabled);
  const ready = useAdsStore(s => s.ready);
  const pro = useIsPro();
  return Platform.OS === 'android' && remote && ready && !pro;
}

export type AdPlacement = 'interstitial' | 'activity' | 'groups' | 'friends';

const placementKey = {
  interstitial: 'interstitial_enabled',
  activity: 'native_activity_enabled',
  groups: 'native_groups_enabled',
  friends: 'native_friends_enabled',
} as const;

/** Whether one placement shows ads: ads on, and its own switch on. */
export function useAdPlacement(placement: AdPlacement): boolean {
  const on = useRemoteConfig(s => s[placementKey[placement]]);
  return useAdsEnabled() && on;
}

let started: Promise<void> | null = null;

/** Gathers consent (showing Google's form only where required), then starts the SDK. */
export function initAds(): Promise<void> {
  started ??= (async () => {
    const m = adsModule();
    if (!m) {
      return;
    }
    try {
      const info = await m.AdsConsent.gatherConsent();
      if (!info.canRequestAds) {
        return;
      }
      const choices = await m.AdsConsent.getUserChoices().catch(() => null);
      await m.default().setRequestConfiguration({
        maxAdContentRating: m.MaxAdContentRating.PG,
      });
      await m.default().initialize();
      useAdsStore.setState({
        ready: true,
        personalised: choices?.selectPersonalisedAds ?? false,
        privacyOptionsRequired:
          info.privacyOptionsRequirementStatus ===
          m.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
      });
    } catch {
      // Offline or consent failed: no ads this session.
      started = null;
    }
  })();
  return started;
}

/** Reopens Google's consent form ("Ad choices" in Account). */
export async function showAdChoices(): Promise<void> {
  const m = adsModule();
  if (!m) {
    return;
  }
  await m.AdsConsent.showPrivacyOptionsForm();
  const choices = await m.AdsConsent.getUserChoices().catch(() => null);
  useAdsStore.setState({
    personalised: choices?.selectPersonalisedAds ?? false,
  });
}

export type AdKind = 'interstitial' | 'native';

/**
 * Debug builds always use Google's test ads, as AdMob requires for anything
 * but real users.
 */
export function adUnitId(kind: AdKind): string {
  const m = adsModule();
  const test = {
    interstitial: m?.TestIds.INTERSTITIAL ?? '',
    native: m?.TestIds.NATIVE ?? '',
  }[kind];
  return __DEV__ ? test : env.adUnits[kind] || test;
}

/** Request options for every ad: non-personalised unless agreed. */
export function adRequestOptions() {
  return {
    requestNonPersonalizedAdsOnly: !useAdsStore.getState().personalised,
  };
}
