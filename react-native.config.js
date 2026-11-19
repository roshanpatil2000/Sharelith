// Firebase and AdMob are set up on Android only for now; keep them out of
// iOS builds until iOS has its own Firebase config, APNs key and AdMob app.
module.exports = {
  dependencies: {
    '@react-native-firebase/app': { platforms: { ios: null } },
    '@react-native-firebase/messaging': { platforms: { ios: null } },
    '@react-native-firebase/crashlytics': { platforms: { ios: null } },
    '@react-native-firebase/perf': { platforms: { ios: null } },
    '@react-native-firebase/remote-config': { platforms: { ios: null } },
    'react-native-google-mobile-ads': { platforms: { ios: null } },
  },
};
