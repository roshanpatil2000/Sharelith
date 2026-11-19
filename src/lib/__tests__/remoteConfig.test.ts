import { buildNumber, isOlderVersion } from '../remoteConfig';

describe('buildNumber', () => {
  it('matches the native build number formula', () => {
    expect(buildNumber('1.0.2')).toBe(10002);
    expect(buildNumber('2.13.7')).toBe(21307);
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
    interstitial_min_minutes: 10,
    interstitial_after_saves: 5,
  };
  const config: Record<string, unknown> = {};
  const rc = {
    getRemoteConfig: jest.fn(() => config),
    fetchAndActivate: jest.fn(async () => true),
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
    jest.dontMock('react-native');
  });
});
