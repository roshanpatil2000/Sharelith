import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { Button, Text } from '@/components';
import { useProfile } from '@/features/account/api';
import { useAuthStore } from '@/features/auth/authStore';
import { SettleArt, SplitArt, TogetherArt } from '../components/WelcomeArt';

const PAGES = [
  {
    key: 'together',
    background: 'welcomeTogether',
    Art: TogetherArt,
    title: 'Good to have you',
    body: 'Trips, flatmates, dinners out: keep every shared cost in one place, and the maths off your mind.',
  },
  {
    key: 'split',
    background: 'welcomeSplit',
    Art: SplitArt,
    title: 'Everyone pays their part',
    body: 'Share a bill equally, by percentage or item by item. Tax and tip can follow what each person had.',
  },
  {
    key: 'settle',
    background: 'welcomeSettle',
    Art: SettleArt,
    title: 'Square up, stay friends',
    body: 'Sharelith untangles who owes whom into fewer payments. Pay your way, then record it here.',
  },
] as const;

/** Grows its illustration into place when that page is showing. */
function PageArt({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const { motion } = useTheme();
  const scale = useSharedValue(active ? 1 : 0.8);
  useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.8, motion.spring);
  }, [active, scale, motion.spring]);
  const grow = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[artStyle.fill, grow]}>{children}</Animated.View>
  );
}

const artStyle = StyleSheet.create({ fill: { flex: 1 } });

/** Three swipeable pages shown after each log in or sign up. */
export function WelcomeTourScreen() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const finish = useAuthStore(s => s.finishWelcome);
  // From the session first, so the greeting doesn't wait for the profile.
  const signedUpAs = useAuthStore(s => s.session?.user.user_metadata.full_name);
  const { data: profile } = useProfile();
  const fullName =
    profile?.full_name ?? (typeof signedUpAs === 'string' ? signedUpAs : '');
  const firstName = fullName.trim().split(/\s+/)[0];

  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const current = useRef(0);
  const last = page === PAGES.length - 1;

  const show = (index: number) => {
    current.current = index;
    setPage(index);
  };
  const goTo = (index: number) => {
    show(index);
    pager.current?.scrollTo({ x: index * width, animated: true });
  };

  // Stay on the same page when the screen's width changes.
  useEffect(() => {
    pager.current?.scrollTo({ x: current.current * width, animated: false });
  }, [width]);

  // Android back steps back a page before it leaves the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (current.current === 0) {
        return false;
      }
      const previous = current.current - 1;
      current.current = previous;
      setPage(previous);
      pager.current?.scrollTo({ x: previous * width, animated: true });
      return true;
    });
    return () => sub.remove();
  }, [width]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors[PAGES[page]!.background] },
      ]}
      testID="welcome-tour"
    >
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={e => show(clampPage(e.nativeEvent.contentOffset.x / width))}
        testID="tour-pager"
      >
        {PAGES.map(({ key, background, Art, title, body }, index) => (
          <View
            key={key}
            style={[
              styles.page,
              {
                width,
                backgroundColor: colors[background],
                // Clear of the Skip button and the footer.
                paddingTop: insets.top + SKIP_ROOM,
                paddingBottom: insets.bottom + FOOTER_ROOM,
                paddingLeft: insets.left + PAGE_MARGIN,
                paddingRight: insets.right + PAGE_MARGIN,
              },
            ]}
            accessibilityElementsHidden={index !== page}
            importantForAccessibility={
              index === page ? 'auto' : 'no-hide-descendants'
            }
            testID={`tour-page-${key}`}
          >
            <Text variant="display" accessibilityRole="header">
              {index === 0 && firstName ? `${title}, ${firstName}` : title}
            </Text>
            <Text color="textSecondary" style={styles.body}>
              {body}
            </Text>
            <View
              style={styles.art}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <PageArt active={index === page}>
                <Art />
              </PageArt>
            </View>
          </View>
        ))}
      </ScrollView>

      {last ? null : (
        <View
          style={[
            styles.skip,
            { top: insets.top + 8, right: insets.right + 8 },
          ]}
        >
          <Button
            title="Skip"
            variant="ghost"
            onPress={finish}
            testID="tour-skip"
          />
        </View>
      )}

      <View
        style={[
          styles.footer,
          {
            bottom: insets.bottom + 16,
            left: insets.left + PAGE_MARGIN,
            right: insets.right + PAGE_MARGIN,
          },
        ]}
      >
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}
          testID="tour-dots"
        >
          {PAGES.map(({ key }, index) => (
            <View
              key={key}
              style={[styles.dot, index === page && styles.dotActive]}
            />
          ))}
        </View>
        <Button
          title={last ? 'Get started' : 'Next'}
          size="lg"
          fullWidth
          onPress={last ? finish : () => goTo(page + 1)}
          testID="tour-next"
        />
      </View>
    </View>
  );
}

const clampPage = (position: number) =>
  Math.min(Math.max(Math.round(position), 0), PAGES.length - 1);

const SKIP_ROOM = 72;
const FOOTER_ROOM = 116;
const PAGE_MARGIN = 24;

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    page: { height: '100%' },
    body: {
      fontSize: 17,
      lineHeight: 24,
      marginTop: t.spacing.md,
      maxWidth: 480,
    },
    // Shrinks on short screens and with large text.
    art: { flex: 1, minHeight: 0, paddingVertical: t.spacing.xxl },
    skip: { position: 'absolute' },
    footer: { position: 'absolute', gap: t.spacing.lg },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: t.spacing.sm,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.primary,
      opacity: 0.3,
    },
    dotActive: { width: 24, opacity: 1 },
  });
