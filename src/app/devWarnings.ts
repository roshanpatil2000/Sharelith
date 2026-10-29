import { LogBox } from 'react-native';

/**
 * Known-harmless third-party warnings, silenced in development only. Keep
 * each entry specific so new warnings still surface.
 */
if (__DEV__) {
  LogBox.ignoreLogs([
    // @gorhom/bottom-sheet 5.2.14 passes a deps array to useAnimatedReaction;
    // Reanimated 4 ignores it on native. Remove when bottom-sheet fixes it.
    '[Reanimated] Dependencies should only be used on the web',
  ]);
}
