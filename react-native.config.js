// Firebase (push, crash reports) is set up on Android only for now; keep it
// out of iOS builds until iOS has its own Firebase config and APNs key.
module.exports = {
  dependencies: {
    '@react-native-firebase/app': { platforms: { ios: null } },
    '@react-native-firebase/messaging': { platforms: { ios: null } },
    '@react-native-firebase/crashlytics': { platforms: { ios: null } },
  },
};
