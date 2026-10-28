import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import {
  useTheme,
  type ColorTokens,
  type RadiusKey,
  type SpacingKey,
} from '@/app/theme';

type SurfaceColor = Exclude<keyof ColorTokens, 'category'>;

export type BoxProps = ViewProps & {
  p?: SpacingKey;
  px?: SpacingKey;
  py?: SpacingKey;
  m?: SpacingKey;
  mx?: SpacingKey;
  my?: SpacingKey;
  gap?: SpacingKey;
  bg?: SurfaceColor;
  radius?: RadiusKey;
  flex?: number;
  direction?: ViewStyle['flexDirection'];
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
};

/** Layout primitive whose spacing props only accept theme tokens. */
export function Box({
  p,
  px,
  py,
  m,
  mx,
  my,
  gap,
  bg,
  radius,
  flex,
  direction,
  align,
  justify,
  wrap,
  style,
  ...rest
}: BoxProps) {
  const t = useTheme();
  const s = (k?: SpacingKey) => (k === undefined ? undefined : t.spacing[k]);
  const tokenStyle: ViewStyle = {
    padding: s(p),
    paddingHorizontal: s(px),
    paddingVertical: s(py),
    margin: s(m),
    marginHorizontal: s(mx),
    marginVertical: s(my),
    gap: s(gap),
    backgroundColor: bg ? t.colors[bg] : undefined,
    borderRadius: radius ? t.radius[radius] : undefined,
    flex,
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? 'wrap' : undefined,
  };
  return <View {...rest} style={[tokenStyle, style]} />;
}

/** Vertical stack. */
export function Stack(props: BoxProps) {
  return <Box direction="column" {...props} />;
}

/** Horizontal row, vertically centered by default. */
export function Row(props: BoxProps) {
  return <Box direction="row" align="center" {...props} />;
}

export function Spacer({ size, flex }: { size?: SpacingKey; flex?: number }) {
  const t = useTheme();
  return (
    <View
      style={
        size
          ? { width: t.spacing[size], height: t.spacing[size] }
          : { flex: flex ?? 1 }
      }
    />
  );
}
