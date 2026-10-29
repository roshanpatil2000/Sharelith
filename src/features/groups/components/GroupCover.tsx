import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Icon } from '@/components';
import { groupTypeIcon } from '../groupTypes';

const sizes = { md: 44, lg: 64, xl: 96 } as const;

type Props = {
  type: string;
  uri?: string | null;
  size?: keyof typeof sizes;
};

/** The group's cover photo, or its type icon on a tinted tile. */
export function GroupCover({ type, uri, size = 'md' }: Props) {
  const styles = useStyles(createStyles);
  const px = sizes[size];
  const box = { width: px, height: px };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.tile, box]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.tile, styles.placeholder, box]}>
      <Icon icon={groupTypeIcon(type)} size={px * 0.45} color="primary" />
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    tile: { borderRadius: t.radius.md },
    placeholder: {
      backgroundColor: t.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
