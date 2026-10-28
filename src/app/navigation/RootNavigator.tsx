import React, { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@/app/theme';
import { useSessionStore } from '@/lib/sessionStore';
import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';
import { AddExpenseScreen } from '@/features/expenses/screens/AddExpenseScreen';
import { ComponentGalleryScreen } from '@/features/dev/ComponentGalleryScreen';
import { MainTabs } from './MainTabs';
import { toNavigationTheme } from './navigationTheme';
import type { AuthStackParamList, RootStackParamList } from './types';

const Root = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  const theme = useTheme();
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        statusBarStyle: theme.scheme === 'dark' ? 'light' : 'dark',
      }}
    >
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const theme = useTheme();
  const navTheme = useMemo(() => toNavigationTheme(theme), [theme]);
  const signedIn = useSessionStore(s => s.devSignedIn);

  return (
    <NavigationContainer theme={navTheme}>
      <Root.Navigator
        screenOptions={{
          headerTitleStyle: theme.typography.heading,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          // Native-stack screens own the iOS status bar appearance.
          statusBarStyle: theme.scheme === 'dark' ? 'light' : 'dark',
        }}
      >
        {signedIn ? (
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
