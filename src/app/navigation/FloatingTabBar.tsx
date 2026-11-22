import React, { useEffect, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import {
  TAB_BAR,
  TAB_BAR_OVERHANG,
  tabBarPath,
  tabCenters,
} from './tabBarShape';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Widening, fading outlines behind the bar. A view's shadow can't follow the
 * notch on Android, so the shadow is drawn with the same path.
 */
const SHADOW = [18, 15, 12, 10, 8, 6, 4, 2] as const;
const SHADOW_ROOM = 12;

/** The gap under the bar, clear of the home indicator or navigation buttons. */
function bottomGap(inset: number): number {
  // The iPhone's home indicator needs less room than its inset gives.
  const clear = Platform.OS === 'ios' ? inset - 10 : inset + 4;
  return Math.max(clear, TAB_BAR.margin);
}

/** What the bar covers, from the bottom of the screen to the top of the circle. */
export const floatingTabBarSpace = (bottomInset: number) =>
  bottomGap(bottomInset) + TAB_BAR.height + TAB_BAR_OVERHANG;

/**
 * A bar floating over the screen. The selected tab rises in a circle, and
 * the notch around it slides from tab to tab.
 */
export function FloatingTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const t = useTheme();
  const styles = useStyles(createStyles);
  const window = useWindowDimensions();
  const left = insets.left + TAB_BAR.margin;
  const width = window.width - left - insets.right - TAB_BAR.margin;
  const gap = bottomGap(insets.bottom);

  const centers = tabCenters(width, state.routes.length);
  const step = centers.length > 1 ? centers[1]! - centers[0]! : width;
  const target = centers[state.index]!;

  const x = useSharedValue(target);
  const lastWidth = useRef(width);
  useEffect(() => {
    // Slide between tabs, but jump when the screen's width changes.
    x.value =
      lastWidth.current === width
        ? withSpring(target, t.motion.spring)
        : target;
    lastWidth.current = width;
  }, [target, width, x, t.motion.spring]);

  const shape = useAnimatedProps(() => ({ d: tabBarPath(width, x.value) }));
  const circleMove = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - TAB_BAR.circle / 2 }],
  }));

  const active = descriptors[state.routes[state.index]!.key]!.options;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { height: gap + TAB_BAR.height + TAB_BAR_OVERHANG }]}
      testID="floating-tab-bar"
    >
      {/* Content fades out as it goes under the bar, so only the plain
          background shows in the notch and around the bar. */}
      <Svg
        pointerEvents="none"
        width={window.width}
        height={TAB_BAR_OVERHANG}
        style={styles.fade}
      >
        <Defs>
          <LinearGradient id="tabBarFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.colors.background} stopOpacity={0} />
            <Stop offset="1" stopColor={t.colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tabBarFade)" />
      </Svg>
      {/* Also takes touches beside and under the bar, so a near miss can't
          open the row, or ad, scrolled beneath it. */}
      <View style={[styles.catcher, { height: gap + TAB_BAR.height }]} />
      <View
        pointerEvents="box-none"
        style={[styles.bar, { left, width, bottom: gap }]}
      >
        <Svg
          pointerEvents="none"
          width={width + SHADOW_ROOM * 2}
          height={TAB_BAR.height + SHADOW_ROOM * 2}
          viewBox={`${-SHADOW_ROOM} ${-SHADOW_ROOM} ${
            width + SHADOW_ROOM * 2
          } ${TAB_BAR.height + SHADOW_ROOM * 2}`}
          style={styles.shape}
        >
          {SHADOW.map(size => (
            <AnimatedPath
              key={size}
              animatedProps={shape}
              fill="none"
              stroke={t.colors.tabBarShadow}
              strokeWidth={size}
              transform="translate(0, 2)"
            />
          ))}
          <AnimatedPath animatedProps={shape} fill={t.colors.tabBar} />
        </Svg>
        <View style={styles.tabs} accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key]!;
            const focused = state.index === index;
            const label = options.title ?? route.name;
            // The outer tabs also take the bar's ends.
            const start = index === 0 ? 0 : centers[index]! - step / 2;
            const end =
              index === centers.length - 1 ? width : centers[index]! + step / 2;
            return (
              <Pressable
                key={route.key}
                testID={`tab-${route.name}`}
                // As React Navigation's own bar does: iOS has no tab role.
                accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'}
                accessibilityLabel={
                  Platform.OS === 'ios'
                    ? `${label}, tab, ${index + 1} of ${state.routes.length}`
                    : label
                }
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                onLongPress={() =>
                  navigation.emit({ type: 'tabLongPress', target: route.key })
                }
                style={[styles.tab, { left: start, width: end - start }]}
              >
                <View
                  style={[
                    styles.icon,
                    { left: centers[index]! - start - ICON / 2 },
                  ]}
                >
                  {focused
                    ? null
                    : options.tabBarIcon?.({
                        focused,
                        color: t.colors.textSecondary,
                        size: ICON,
                      })}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Animated.View
          style={[styles.circle, circleMove]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="tab-circle"
        >
          {active.tabBarIcon?.({
            focused: true,
            color: t.colors.primary,
            size: ICON,
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const ICON = 26;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    fade: { position: 'absolute', left: 0, top: 0 },
    catcher: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.colors.background,
    },
    bar: { position: 'absolute', height: TAB_BAR.height },
    shape: { position: 'absolute', left: -SHADOW_ROOM, top: -SHADOW_ROOM },
    tabs: { height: TAB_BAR.height },
    tab: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
    icon: { position: 'absolute', width: ICON, height: ICON },
    circle: {
      position: 'absolute',
      left: 0,
      top: -TAB_BAR_OVERHANG,
      width: TAB_BAR.circle,
      height: TAB_BAR.circle,
      borderRadius: TAB_BAR.circle / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.tabBar,
      ...t.elevation[2],
    },
  });
