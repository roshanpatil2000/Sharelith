import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { useRemoteConfig } from '@/lib/remoteConfig';
import {
  adRequestOptions,
  adUnitId,
  initAds,
  useAdsEnabled,
  useAdsStore,
} from '../ads';
import { interstitialDue, isAdBreak } from '../interstitial';
import { withAdSlots, NATIVE_AD_EVERY } from '../NativeAdRow';

// Ads are Android only: run this file as Android.
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  rn.Platform.OS = 'android';
  return rn;
});

describe('isAdBreak', () => {
  it('counts moves between tabs and into or out of details', () => {
    expect(isAdBreak('Groups', 'Friends')).toBe(true);
    expect(isAdBreak('Groups', 'GroupDetail')).toBe(true);
    expect(isAdBreak('ExpenseDetail', 'GroupDetail')).toBe(true);
  });

  it('never opening a form, signing in, or staying put', () => {
    expect(isAdBreak('Groups', 'AddExpense')).toBe(false);
    expect(isAdBreak('FriendDetail', 'SettleUp')).toBe(false);
    expect(isAdBreak('Welcome', 'LogIn')).toBe(false);
    expect(isAdBreak('Groups', 'Groups')).toBe(false);
    expect(isAdBreak(undefined, 'Groups')).toBe(false);
  });
});

describe('interstitialDue', () => {
  const now = 1_000_000_000;
  it('waits for the first few breaks', () => {
    expect(interstitialDue(3, 0, now, 3, 5)).toBe(false);
    expect(interstitialDue(4, 0, now, 3, 5)).toBe(true);
  });

  it('shows at most once per few minutes', () => {
    expect(interstitialDue(10, now - 4 * 60_000, now, 3, 5)).toBe(false);
    expect(interstitialDue(10, now - 5 * 60_000, now, 3, 5)).toBe(true);
  });
});

describe('withAdSlots', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it('adds an ad after every tenth item', () => {
    const entries = withAdSlots(items, true);
    const adPositions = entries
      .map((e, i) => (e.type === 'ad' ? i : -1))
      .filter(i => i >= 0);
    expect(adPositions).toEqual([NATIVE_AD_EVERY, NATIVE_AD_EVERY * 2 + 1]);
    expect(entries.filter(e => e.type === 'item')).toHaveLength(25);
  });

  it('adds none when ads are off or the feed is short', () => {
    expect(withAdSlots(items, false).some(e => e.type === 'ad')).toBe(false);
    expect(withAdSlots([1, 2, 3], true).some(e => e.type === 'ad')).toBe(false);
  });
});

describe('ads switch', () => {
  const Probe = () => <Text>{String(useAdsEnabled())}</Text>;

  it('allows ads only after consent, and Remote Config can turn them off', async () => {
    const view = await render(<Probe />);
    expect(screen.getByText('false')).toBeOnTheScreen();

    await act(() => initAds());
    await view.rerender(<Probe />);
    expect(screen.getByText('true')).toBeOnTheScreen();
    expect(useAdsStore.getState()).toMatchObject({
      personalised: false,
      privacyOptionsRequired: true,
    });
    expect(adRequestOptions()).toEqual({
      requestNonPersonalizedAdsOnly: true,
    });

    await act(() => useRemoteConfig.setState({ ads_enabled: false }));
    expect(screen.getByText('false')).toBeOnTheScreen();
  });

  it('uses test ads in debug builds', () => {
    expect(adUnitId('interstitial')).toBe('test-interstitial');
    expect(adUnitId('native')).toBe('test-native');
  });
});
