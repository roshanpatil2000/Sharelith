import React from 'react';
import { Image, StyleSheet } from 'react-native';

const logo = require('../../../../assets/app-logo.png');

/** The app icon, used on Welcome and the loading screen. */
export function AuthLogo({ size = 96 }: { size?: number }) {
  return (
    <Image
      source={logo}
      style={[styles.logo, { width: size, height: size }]}
      accessibilityLabel="Sharelith"
      accessible
    />
  );
}

const styles = StyleSheet.create({
  logo: { resizeMode: 'contain' },
});
