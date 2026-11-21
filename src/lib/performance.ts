import { Platform } from 'react-native';
import { isEmulatorSync } from 'react-native-device-info';

/**
 * Firebase Performance, Android only for now. It measures app start-up and
 * network calls on its own. Collection is off in debug builds and on
 * emulators, so our own testing doesn't skew the numbers: release builds on
 * the emulator (installed over and over, first launches after each install,
 * a slow virtual GPU) made app start look 75% slower than it is on phones.
 * The setting is kept on the device, so it applies from the next launch.
 */
export function initPerformance(): void {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    const perf = require('@react-native-firebase/perf');
    perf.getPerformance().dataCollectionEnabled = !__DEV__ && !isEmulator();
  } catch {
    // No Firebase config in this build.
  }
}

function isEmulator(): boolean {
  try {
    return isEmulatorSync();
  } catch {
    return false;
  }
}
