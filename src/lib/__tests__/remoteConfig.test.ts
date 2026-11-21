import { installedBuildNumber, isOlderVersion } from '../remoteConfig';

describe('installedBuildNumber', () => {
  it('reads the build number of the installed app', () => {
    expect(installedBuildNumber()).toBe('1795196400');
  });
});

describe('isOlderVersion', () => {
  it('compares each part as a number', () => {
    expect(isOlderVersion('1.0.1', '1.0.2')).toBe(true);
    expect(isOlderVersion('1.0.10', '1.0.9')).toBe(false);
    expect(isOlderVersion('1.2.0', '1.10.0')).toBe(true);
  });

  it('treats equal and missing parts as the same version', () => {
    expect(isOlderVersion('1.0.1', '1.0.1')).toBe(false);
    expect(isOlderVersion('1.0', '1.0.0')).toBe(false);
    expect(isOlderVersion('2.0.0', '1.9.9')).toBe(false);
  });
});

describe('loadRemoteConfig on Android', () => {
  const values: Record<string, string | boolean | number> = {
    min_supported_version: '1.2.0',
    update_url: 'https://example.com/update',
    reminders_enabled: false,
    push_prompt_enabled: true,
    ads_enabled: false,
    interstitial_enabled: true,
    native_activity_enabled: true,
    native_groups_enabled: false,
    native_friends_enabled: true,
    interstitial_min_minutes: 10,
    interstitial_skip_first: 5,
    pro_monthly_sku: 'pro_monthly',
    pro_yearly_sku: 'pro_yearly',
  };
  const config: Record<string, unknown> = {};
  let onUpdate: (() => void) | undefined;
  const rc = {
    getRemoteConfig: jest.fn(() => config),
    fetchAndActivate: jest.fn(async () => true),
    activate: jest.fn(async () => true),
    onConfigUpdate: jest.fn((_c: unknown, observer: { next: () => void }) => {
      onUpdate = observer.next;
      return () => {};
    }),
    getValue: jest.fn((_c: unknown, key: string) => ({
      asString: () => String(values[key]),
      asBoolean: () => values[key] === true,
      asNumber: () => Number(values[key]),
    })),
  };

  it('applies fetched values and keeps defaults until then', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => {
      const rn = jest.requireActual('react-native');
      rn.Platform.OS = 'android';
      return rn;
    });
    jest.doMock('@react-native-firebase/remote-config', () => rc);
    const m = require('../remoteConfig') as typeof import('../remoteConfig');
    expect(m.useRemoteConfig.getState().reminders_enabled).toBe(true);

    await m.loadRemoteConfig();
    expect(config.defaultConfig).toEqual(m.remoteDefaults);
    expect(m.useRemoteConfig.getState()).toEqual(values);

    // Publishing in the console reaches the app without a relaunch.
    values.native_groups_enabled = true;
    values.ads_enabled = true;
    onUpdate!();
    await new Promise<void>(r => setTimeout(r, 0));
    expect(rc.activate).toHaveBeenCalled();
    expect(m.useRemoteConfig.getState()).toMatchObject({
      native_groups_enabled: true,
      ads_enabled: true,
    });
    jest.dontMock('react-native');
  });
});
