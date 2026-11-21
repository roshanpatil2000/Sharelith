import { Platform } from 'react-native';
import { isEmulatorSync } from 'react-native-device-info';

const perf = { dataCollectionEnabled: true };
jest.mock(
  '@react-native-firebase/perf',
  () => ({ getPerformance: () => perf }),
  { virtual: true },
);

const setDev = (value: boolean) => {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
};

describe('initPerformance', () => {
  const original = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = original;
  });

  // Jest runs with __DEV__ true, so check the emulator rule on its own too.
  it('never collects in debug builds', () => {
    const { initPerformance } = require('../performance');
    initPerformance();
    expect(perf.dataCollectionEnabled).toBe(false);
  });

  it('never collects on an emulator', () => {
    jest.mocked(isEmulatorSync).mockReturnValueOnce(true);
    setDev(false);
    const { initPerformance } = require('../performance');
    initPerformance();
    expect(perf.dataCollectionEnabled).toBe(false);
    setDev(true);
  });

  it('collects in release builds on a phone', () => {
    setDev(false);
    const { initPerformance } = require('../performance');
    initPerformance();
    expect(perf.dataCollectionEnabled).toBe(true);
    setDev(true);
  });
});
