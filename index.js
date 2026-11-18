/**
 * @format
 */

import { AppRegistry } from 'react-native';
import './src/app/devWarnings';
import App from './App';
import { registerBackgroundHandler } from './src/features/push/push';
import { name as appName } from './app.json';

// Before the app renders, as Firebase requires.
registerBackgroundHandler();
AppRegistry.registerComponent(appName, () => App);
