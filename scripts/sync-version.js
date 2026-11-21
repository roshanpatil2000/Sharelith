#!/usr/bin/env node
// Copies the version in package.json into the iOS project, so both apps ship
// the same version. Android reads package.json itself (android/app/build.gradle).
// The build number isn't set here: both apps use the build time in epoch
// seconds, set while building (Gradle, and Xcode's "Set build number" phase).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match) {
  console.error(`package.json version "${version}" must look like 1.2.3`);
  process.exit(1);
}

const iosDir = path.join(root, 'ios');
const project = fs
  .readdirSync(iosDir)
  .find(name => name.endsWith('.xcodeproj'));
const pbxproj = path.join(iosDir, project, 'project.pbxproj');
const before = fs.readFileSync(pbxproj, 'utf8');
const after = before.replace(
  /MARKETING_VERSION = [^;]+;/g,
  `MARKETING_VERSION = ${version};`,
);
fs.writeFileSync(pbxproj, after);
console.log(`iOS version ${version}`);
