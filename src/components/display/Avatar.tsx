import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { avatarColors, useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const sizes: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

type Props = {
  name: string;
  uri?: string | null;
  size?: AvatarSize;
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Stable color per name so each person keeps the same avatar tint. */
export function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 1_000_003;
  }
  return avatarColors[hash % avatarColors.length] ?? avatarColors[0];
}

export function Avatar({ name, uri, size = 'md' }: Props) {
  const styles = useStyles(createStyles);
  const dim = sizes[size];
  const box = { width: dim, height: dim, borderRadius: dim / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, box]}
        accessibilityLabel={name}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={[styles.base, box, { backgroundColor: avatarColorFor(name) }]}
      accessibilityLabel={name}
      accessible
    >
      <Text
        variant={dim >= 56 ? 'title' : 'label'}
        style={[
          styles.initials,
          { fontSize: dim * 0.38, lineHeight: dim * 0.46 },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

type StackProps = {
  people: { name: string; uri?: string | null }[];
  size?: AvatarSize;
  max?: number;
};

export function AvatarStack({ people, size = 'sm', max = 4 }: StackProps) {
  const styles = useStyles(createStyles);
  const dim = sizes[size];
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={styles.stack}>
      {shown.map((p, i) => (
        <View
          key={`${p.name}-${i}`}
          style={[styles.ring, i > 0 && { marginLeft: -dim / 3 }]}
        >
          <Avatar name={p.name} uri={p.uri} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.ring,
            styles.more,
            {
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              marginLeft: -dim / 3,
            },
          ]}
        >
          <Text variant="caption" color="textSecondary">
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    initials: { color: '#FFFFFF' },
    stack: { flexDirection: 'row', alignItems: 'center' },
    ring: {
      borderWidth: 2,
      borderColor: t.colors.background,
      borderRadius: t.radius.pill,
    },
    more: {
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
