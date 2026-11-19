import { Platform } from 'react-native';

/**
 * Firebase Performance, Android only for now. It measures app start-up and
 * network calls on its own; collection is off in debug builds so our own
 * testing doesn't skew the numbers.
 */
export function initPerformance(): void {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    const perf = require('@react-native-firebase/perf');
    perf.getPerformance().dataCollectionEnabled = !__DEV__;
  } catch {
    // No Firebase config in this build.
  }
}
