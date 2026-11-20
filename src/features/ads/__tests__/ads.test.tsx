import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { remoteDefaults, useRemoteConfig } from '@/lib/remoteConfig';
import {
  adRequestOptions,
  adUnitId,
  initAds,
  useAdPlacement,
  useAdsEnabled,
  useAdsStore,
} from '../ads';
import { interstitialDue, isAdBreak } from '../interstitial';
import { LIST_AD_SPACING, NATIVE_AD_EVERY, withAdSlots } from '../NativeAdRow';

const mockIsPro = jest.fn(() => false);
jest.mock('@/features/pro/pro', () => ({ useIsPro: () => mockIsPro() }));

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

  it('puts one after the 3rd group or friend, then every 8, or at the end of a short list', () => {
    const adsAt = (n: number) =>
      withAdSlots(
        Array.from({ length: n }, (_, i) => i),
        true,
        LIST_AD_SPACING,
      )
        .map((e, i) => (e.type === 'ad' ? i : -1))
        .filter(i => i >= 0);
    expect(adsAt(0)).toEqual([]);
    expect(adsAt(1)).toEqual([1]);
    expect(adsAt(2)).toEqual([2]);
    expect(adsAt(3)).toEqual([3]);
    expect(adsAt(12)).toEqual([3, 12]);
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

  it('shows no ads to Pro users', async () => {
    await act(() => initAds());
    mockIsPro.mockReturnValue(true);
    await render(<Probe />);
    expect(screen.getByText('false')).toBeOnTheScreen();
    mockIsPro.mockReturnValue(false);
  });

  it('each switch hides only its own placement; ads_enabled hides all', async () => {
    await act(() => initAds());
    const Placements = () => {
      const interstitial = useAdPlacement('interstitial');
      const activity = useAdPlacement('activity');
      const groups = useAdPlacement('groups');
      const friends = useAdPlacement('friends');
      return (
        <Text>
          {`interstitial:${interstitial} activity:${activity} groups:${groups} friends:${friends}`}
        </Text>
      );
    };
    await act(() => useRemoteConfig.setState(remoteDefaults));
    const view = await render(<Placements />);
    expect(
      screen.getByText(
        'interstitial:true activity:true groups:true friends:true',
      ),
    ).toBeOnTheScreen();

    await act(() =>
      useRemoteConfig.setState({
        native_groups_enabled: false,
        interstitial_enabled: false,
      }),
    );
    await view.rerender(<Placements />);
    expect(
      screen.getByText(
        'interstitial:false activity:true groups:false friends:true',
      ),
    ).toBeOnTheScreen();

    await act(() =>
      useRemoteConfig.setState({ ...remoteDefaults, ads_enabled: false }),
    );
    await view.rerender(<Placements />);
    expect(
      screen.getByText(
        'interstitial:false activity:false groups:false friends:false',
      ),
    ).toBeOnTheScreen();
    await act(() => useRemoteConfig.setState(remoteDefaults));
  });

  it('uses test ads in debug builds', () => {
    expect(adUnitId('interstitial')).toBe('test-interstitial');
    expect(adUnitId('native')).toBe('test-native');
  });
});
