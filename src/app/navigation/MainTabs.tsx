import React, { useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createBottomTabNavigator,
  BottomTabBar,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {
  Activity,
  CircleUserRound,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '@/app/theme';
import { FriendsScreen } from '@/features/friends/screens/FriendsScreen';
import { GroupsScreen } from '@/features/groups/screens/GroupsScreen';
import { ActivityScreen } from '@/features/activity/screens/ActivityScreen';
import { useLiveUpdates } from '@/features/activity/liveUpdates';
import { AccountScreen } from '@/features/account/screens/AccountScreen';
import { headerTitleStyle } from './navigationTheme';
import { StripTabBar } from './StripTabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** From this width (tablets, unfolded foldables, landscape) tabs become a side rail. */
export const SIDE_RAIL_MIN_WIDTH = 600;

/** A side safe-area inset this wide is a system strip (closed iPhone Duo) with room for tab buttons. */
export const STRIP_MIN_INSET = 56;

type TabIconProps = { color: string; size: number };

function tabIcon(IconComponent: LucideIcon) {
  return ({ color, size }: TabIconProps) => (
    <IconComponent color={color} size={size} strokeWidth={2} />
  );
}

const tabIcons: Record<keyof MainTabParamList, ReturnType<typeof tabIcon>> = {
  Groups: tabIcon(Users),
  Friends: tabIcon(User),
  Activity: tabIcon(Activity),
  Account: tabIcon(CircleUserRound),
};

export function MainTabs() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sideRail = width >= SIDE_RAIL_MIN_WIDTH;
  const strip: 'left' | 'right' | null = sideRail
    ? null
    : insets.right >= STRIP_MIN_INSET
    ? 'right'
    : insets.left >= STRIP_MIN_INSET
    ? 'left'
    : null;
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) =>
      strip ? (
        <StripTabBar {...props} side={strip} />
      ) : (
        <BottomTabBar {...props} />
      ),
    [strip],
  );
  // Signed in from here on: keep balances current as others change them.
  useLiveUpdates();
  return (
    <Tab.Navigator
      initialRouteName="Groups"
      tabBar={renderTabBar}
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textSecondary,
        // No lineHeight here: the tab bar sizes the label itself, and a fixed
        // line height clips descenders on Android.
        tabBarLabelStyle: {
          fontFamily: t.typography.label.fontFamily,
          fontWeight: t.typography.label.fontWeight,
          fontSize: 12,
        },
        headerTitleStyle: headerTitleStyle(t),
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        tabBarIcon: tabIcons[route.name],
        tabBarPosition: sideRail ? 'left' : 'bottom',
        // A compact rail: label under the icon, so it stays narrow.
        tabBarVariant: sideRail ? 'material' : 'uikit',
        tabBarLabelPosition: sideRail ? 'below-icon' : undefined,
      })}
    >
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
