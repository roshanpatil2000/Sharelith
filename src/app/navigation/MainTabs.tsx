import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
import { AccountScreen } from '@/features/account/screens/AccountScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

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
  return (
    <Tab.Navigator
      initialRouteName="Groups"
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textSecondary,
        tabBarLabelStyle: t.typography.caption,
        headerTitleStyle: t.typography.heading,
        headerShadowVisible: false,
        tabBarIcon: tabIcons[route.name],
      })}
    >
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
