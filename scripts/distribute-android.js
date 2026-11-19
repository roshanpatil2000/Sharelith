#!/usr/bin/env node
/**
 * Builds a signed release APK and sends it to testers with Firebase App
 * Distribution. Testers get an email with an install link.
 *
 *   npm run distribute:android -- "What's new in this build"
 *
 * Once: `npx firebase-tools login`, and add a tester group called "testers"
 * in the Firebase console (App Distribution → Testers & Groups).
 * Set FIREBASE_TESTER_GROUPS to use other groups (comma-separated).
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const servicesFile = path.join(root, 'android/app/google-services.json');
if (!fs.existsSync(servicesFile)) {
  console.error('Missing android/app/google-services.json (see docs/PUSH.md).');
  process.exit(1);
}
const services = JSON.parse(fs.readFileSync(servicesFile, 'utf8'));
const client = services.client.find(
  c => c.client_info.android_client_info.package_name === 'com.sharelith.app',
);
if (!client) {
  console.error('google-services.json has no app for com.sharelith.app.');
  process.exit(1);
}

const { version } = require('../package.json');
const notes =
  process.argv.slice(2).join(' ').trim() || `Sharelith ${version} for testing.`;
const groups = process.env.FIREBASE_TESTER_GROUPS || 'testers';

console.log(`Building Sharelith ${version}…`);
execFileSync('./gradlew', [':app:assembleRelease'], {
  cwd: path.join(root, 'android'),
  stdio: 'inherit',
});

const apk = path.join(
  root,
  'android/app/build/outputs/apk/release/app-release.apk',
);
console.log(`Uploading to App Distribution (groups: ${groups})…`);
execFileSync(
  'npx',
  [
    '--yes',
    'firebase-tools@15',
    'appdistribution:distribute',
    apk,
    '--app',
    client.client_info.mobilesdk_app_id,
    '--groups',
    groups,
    '--release-notes',
    notes,
  ],
  { cwd: root, stdio: 'inherit' },
);
