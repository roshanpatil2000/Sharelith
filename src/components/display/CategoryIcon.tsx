import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Car,
  Clapperboard,
  House,
  Plane,
  Receipt,
  Sparkles,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useStyles, useTheme, type CategoryKey, type Theme } from '@/app/theme';
import { Icon } from '../primitives/Icon';

const icons: Record<CategoryKey, LucideIcon> = {
  food: Utensils,
  home: House,
  transport: Car,
  entertainment: Clapperboard,
  utilities: Zap,
  life: Sparkles,
  travel: Plane,
  general: Receipt,
};

type Props = { category: CategoryKey; size?: number };

/** Rounded tile with a category glyph, shown beside each expense. */
export function CategoryIcon({ category, size = 40 }: Props) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const tint = colors.category[category];
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: `${tint}22` },
      ]}
      accessibilityLabel={`${category} category`}
      accessible
    >
      <Icon icon={icons[category]} size={size * 0.5} tint={tint} />
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    tile: {
      borderRadius: t.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
