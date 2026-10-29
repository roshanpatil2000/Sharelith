import React, { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { useTheme, type Theme } from '@/app/theme';
import { useAuthStatus, useAuthStore } from '@/features/auth/authStore';
import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';
import { SignUpScreen } from '@/features/auth/screens/SignUpScreen';
import { CheckEmailScreen } from '@/features/auth/screens/CheckEmailScreen';
import { LogInScreen } from '@/features/auth/screens/LogInScreen';
import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '@/features/auth/screens/ResetPasswordScreen';
import { VerifyEmailScreen } from '@/features/auth/screens/VerifyEmailScreen';
import { SplashScreen } from '@/features/auth/screens/SplashScreen';
import { EditProfileScreen } from '@/features/account/screens/EditProfileScreen';
import { ChangePasswordScreen } from '@/features/account/screens/ChangePasswordScreen';
import { AddExpenseScreen } from '@/features/expenses/screens/AddExpenseScreen';
import { ComponentGalleryScreen } from '@/features/dev/ComponentGalleryScreen';
import { AddFriendScreen } from '@/features/friends/screens/AddFriendScreen';
import { FriendDetailScreen } from '@/features/friends/screens/FriendDetailScreen';
import { CreateGroupScreen } from '@/features/groups/screens/CreateGroupScreen';
import { GroupDetailScreen } from '@/features/groups/screens/GroupDetailScreen';
import { GroupSettingsScreen } from '@/features/groups/screens/GroupSettingsScreen';
import { AddGroupMembersScreen } from '@/features/groups/screens/AddGroupMembersScreen';
import { MainTabs } from './MainTabs';
import { headerTitleStyle, toNavigationTheme } from './navigationTheme';
import type { AuthStackParamList, RootStackParamList } from './types';

const Root = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function stackOptions(theme: Theme): NativeStackNavigationOptions {
  return {
    headerTitleStyle: headerTitleStyle(theme),
    headerTitleAlign: 'center',
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    // Native-stack screens own the iOS status bar appearance.
    statusBarStyle: theme.scheme === 'dark' ? 'light' : 'dark',
  };
}

function AuthNavigator() {
  const theme = useTheme();
  return (
    <AuthStack.Navigator screenOptions={stackOptions(theme)}>
      <AuthStack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ title: 'Sign up' }}
      />
      <AuthStack.Screen
        name="CheckEmail"
        component={CheckEmailScreen}
        options={{ title: '' }}
      />
      <AuthStack.Screen
        name="LogIn"
        component={LogInScreen}
        options={{ title: 'Log in' }}
      />
      <AuthStack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: 'Reset password' }}
      />
      <AuthStack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ title: 'Enter code' }}
      />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const theme = useTheme();
  const navTheme = useMemo(() => toNavigationTheme(theme), [theme]);
  const status = useAuthStatus();
  const resetPending = useAuthStore(s => s.passwordResetPending);

  if (status === 'loading') {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Root.Navigator screenOptions={stackOptions(theme)}>
        {status === 'signedIn' && resetPending ? (
          // Opened a reset or invite link: choose a password before anything
          // else. A distinct route name, so saving lands on Main rather than
          // the regular ChangePassword screen.
          <Root.Screen
            name="SetPassword"
            component={ChangePasswordScreen}
            options={{
              title:
                resetPending === 'invite'
                  ? 'Welcome to Sharelith'
                  : 'Set new password',
              headerBackVisible: false,
            }}
          />
        ) : status === 'signedIn' ? (
          <>
            <Root.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Root.Screen
              name="AddExpense"
              component={AddExpenseScreen}
              options={{ presentation: 'modal', title: 'Add expense' }}
            />
            <Root.Screen
              name="VerifyEmail"
              component={VerifyEmailScreen}
              options={{ title: 'Confirm email' }}
            />
            <Root.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ title: 'Edit profile' }}
            />
            <Root.Screen
              name="ChangePassword"
              component={ChangePasswordScreen}
              options={{ title: 'Change password' }}
            />
            <Root.Screen
              name="AddFriend"
              component={AddFriendScreen}
              options={{ presentation: 'modal', title: 'Add friend' }}
            />
            <Root.Screen
              name="FriendDetail"
              component={FriendDetailScreen}
              options={{ title: '' }}
            />
            <Root.Screen
              name="CreateGroup"
              component={CreateGroupScreen}
              options={{ presentation: 'modal', title: 'Create a group' }}
            />
            <Root.Screen
              name="GroupDetail"
              component={GroupDetailScreen}
              options={{ title: '' }}
            />
            <Root.Screen
              name="GroupSettings"
              component={GroupSettingsScreen}
              options={{ title: 'Group settings' }}
            />
            <Root.Screen
              name="AddGroupMembers"
              component={AddGroupMembersScreen}
              options={{ presentation: 'modal', title: 'Add people' }}
            />
            <Root.Screen
              name="ComponentGallery"
              component={ComponentGalleryScreen}
              options={{ title: 'Component gallery' }}
            />
          </>
        ) : (
          <Root.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false }}
          />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}
