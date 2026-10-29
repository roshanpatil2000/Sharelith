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
import { MainTabs } from './MainTabs';
import { toNavigationTheme } from './navigationTheme';
import type { AuthStackParamList, RootStackParamList } from './types';

const Root = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function stackOptions(theme: Theme): NativeStackNavigationOptions {
  return {
    headerTitleStyle: theme.typography.heading,
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
          // Opened a reset link: choose a new password before anything else.
          <Root.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{ title: 'Set new password', headerBackVisible: false }}
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
