/**
 * @format
 */

// Secure random numbers (crypto.getRandomValues) for the cache key.
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import './src/app/devWarnings';
import App from './App';
import { registerBackgroundHandler } from './src/features/push/push';
import { initPerformance } from './src/lib/performance';
import { name as appName } from './app.json';

// Before the app renders, as Firebase requires.
registerBackgroundHandler();
initPerformance();
AppRegistry.registerComponent(appName, () => App);
