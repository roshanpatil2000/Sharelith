import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import BootSplash from 'react-native-bootsplash';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
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
import { NotificationsScreen } from '@/features/account/screens/NotificationsScreen';
import { TermsPrompt } from '@/features/auth/components/TermsPrompt';
import { ProScreen } from '@/features/pro/screens/ProScreen';
import { InsightsScreen } from '@/features/pro/screens/InsightsScreen';
import { DeleteAccountScreen } from '@/features/account/screens/DeleteAccountScreen';
import { AddExpenseScreen } from '@/features/expenses/screens/AddExpenseScreen';
import { SettleUpScreen } from '@/features/expenses/screens/SettleUpScreen';
import { ExpenseDetailScreen } from '@/features/expenses/screens/ExpenseDetailScreen';
import { AddFriendScreen } from '@/features/friends/screens/AddFriendScreen';
import { InviteBridge } from '@/features/invites/InviteBridge';
import { ChooseContactScreen } from '@/features/invites/screens/ChooseContactScreen';
import { InviteScreen } from '@/features/invites/screens/InviteScreen';
import { SearchScreen } from '@/features/search/screens/SearchScreen';
import { RecentlyDeletedScreen } from '@/features/expenses/screens/RecentlyDeletedScreen';
import { GroupTotalsScreen } from '@/features/groups/screens/GroupTotalsScreen';
import { DefaultSplitScreen } from '@/features/groups/screens/DefaultSplitScreen';
import { FriendDetailScreen } from '@/features/friends/screens/FriendDetailScreen';
import { CreateGroupScreen } from '@/features/groups/screens/CreateGroupScreen';
import { GroupDetailScreen } from '@/features/groups/screens/GroupDetailScreen';
import { GroupSettingsScreen } from '@/features/groups/screens/GroupSettingsScreen';
import { AddGroupMembersScreen } from '@/features/groups/screens/AddGroupMembersScreen';
import { WelcomeTourScreen } from '@/features/welcome/screens/WelcomeTourScreen';
import { GetStartedScreen } from '@/features/welcome/screens/GetStartedScreen';
import { AppearanceScreen } from '@/features/account/screens/AppearanceScreen';
import { PushBridge } from '@/features/push/PushBridge';
import { useAdPlacement } from '@/features/ads/ads';
import { isAdBreak, maybeShowInterstitial } from '@/features/ads/interstitial';
import { MainTabs } from './MainTabs';
import { headerTitleStyle, toNavigationTheme } from './navigationTheme';
import type { AuthStackParamList, RootStackParamList } from './types';

const Root = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * iOS shows modal screens above the app root, so bottom sheets hosted at the
 * root would open behind them. Modal screens host their own.
 */
const modalLayout = ({ children }: { children: React.ReactNode }) => (
  <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
);
/** Settings and other side screens cross-fade; drilling in slides. */
const fade: NativeStackNavigationOptions = {
  animation: 'fade',
  animationDuration: 180,
};
/** Full-screen forms draw their own header: close, title and save. */
const fullForm: NativeStackNavigationOptions = { headerShown: false };

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function stackOptions(theme: Theme): NativeStackNavigationOptions {
  return {
    headerTitleStyle: headerTitleStyle(theme),
    headerTitleAlign: 'center',
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    animation: 'slide_from_right',
    animationDuration: 300,
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
  const welcomePending = useAuthStore(s => s.welcomePending);
  // The bridges ask permissions and open screens that only exist after the
  // welcome pages.
  const setupPending = useAuthStore(s => s.setupPending);
  const startGroup = useAuthStore(s => s.startGroup);
  const inApp =
    status === 'signedIn' && !resetPending && !welcomePending && !setupPending;
  useEffect(() => {
    if (inApp && startGroup) {
      useAuthStore.getState().clearStartGroup();
      navigationRef.navigate('CreateGroup', { type: startGroup });
    }
  }, [inApp, startGroup]);
  const adsEnabled = useAdPlacement('interstitial');
  const lastRoute = useRef<string | undefined>(undefined);

  // Moving between tabs or into and out of details is a natural break for
  // an occasional full-screen ad (capped in maybeShowInterstitial).
  const onNavigationChange = useCallback(() => {
    const to = navigationRef.getCurrentRoute()?.name;
    const from = lastRoute.current;
    lastRoute.current = to;
    if (
      status === 'signedIn' &&
      from !== 'WelcomeTour' &&
      from !== 'GetStarted' &&
      isAdBreak(from, to)
    ) {
      maybeShowInterstitial(adsEnabled).catch(() => {});
    }
  }, [adsEnabled, status]);

  // The native splash stays up until we know whether someone is signed in.
  useEffect(() => {
    if (status !== 'loading') {
      BootSplash.hide({ fade: true }).catch(() => {});
    }
  }, [status]);

  if (status === 'loading') {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        lastRoute.current = navigationRef.getCurrentRoute()?.name;
      }}
      onStateChange={onNavigationChange}
    >
      {inApp ? <PushBridge navigation={navigationRef} /> : null}
      {status === 'signedIn' && !resetPending ? <TermsPrompt /> : null}
      {inApp ? <InviteBridge navigation={navigationRef} /> : null}
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
        ) : status === 'signedIn' && welcomePending ? (
          <Root.Screen
            name="WelcomeTour"
            component={WelcomeTourScreen}
            options={{ headerShown: false, animation: 'fade' }}
          />
        ) : status === 'signedIn' && setupPending ? (
          <Root.Screen
            name="GetStarted"
            component={GetStartedScreen}
            options={{ headerShown: false }}
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
              layout={modalLayout}
              component={AddExpenseScreen}
              options={{ ...fullForm, ...fade }}
            />
            <Root.Screen
              name="ExpenseDetail"
              component={ExpenseDetailScreen}
              options={{ title: 'Expense' }}
            />
            <Root.Screen
              name="SettleUp"
              layout={modalLayout}
              component={SettleUpScreen}
              options={{ presentation: 'modal', title: 'Settle up' }}
            />
            <Root.Screen
              name="VerifyEmail"
              component={VerifyEmailScreen}
              options={{ title: 'Confirm email' }}
            />
            <Root.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ ...fade, title: 'Edit profile' }}
            />
            <Root.Screen
              name="ChangePassword"
              component={ChangePasswordScreen}
              options={{ ...fade, title: 'Change password' }}
            />
            <Root.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ ...fade, title: 'Notifications' }}
            />
            <Root.Screen
              name="Insights"
              component={InsightsScreen}
              options={{ ...fade, title: 'Insights' }}
            />
            <Root.Screen
              name="Pro"
              component={ProScreen}
              options={{ ...fade, title: 'Sharelith Pro' }}
            />
            <Root.Screen
              name="DeleteAccount"
              component={DeleteAccountScreen}
              options={{ ...fade, title: 'Delete account' }}
            />
            <Root.Screen
              name="AddFriend"
              layout={modalLayout}
              component={AddFriendScreen}
              options={{ presentation: 'modal', title: 'Add friend' }}
            />
            <Root.Screen
              name="Appearance"
              component={AppearanceScreen}
              options={{ ...fade, title: 'Appearance' }}
            />
            <Root.Screen
              name="RecentlyDeleted"
              component={RecentlyDeletedScreen}
              options={{ ...fade, title: 'Recently deleted' }}
            />
            <Root.Screen
              name="Search"
              component={SearchScreen}
              options={{ ...fade, title: 'Search' }}
            />
            <Root.Screen
              name="ChooseContact"
              component={ChooseContactScreen}
              options={{ title: 'Choose a contact' }}
            />
            <Root.Screen
              name="Invite"
              component={InviteScreen}
              options={{ title: 'Invite with a link' }}
            />
            <Root.Screen
              name="FriendDetail"
              component={FriendDetailScreen}
              options={{ title: '' }}
            />
            <Root.Screen
              name="CreateGroup"
              layout={modalLayout}
              component={CreateGroupScreen}
              options={fullForm}
            />
            <Root.Screen
              name="GroupDetail"
              component={GroupDetailScreen}
              options={{ title: '' }}
            />
            <Root.Screen
              name="DefaultSplit"
              component={DefaultSplitScreen}
              options={{ title: 'Default split' }}
            />
            <Root.Screen
              name="GroupTotals"
              component={GroupTotalsScreen}
              options={{ title: 'Group totals' }}
            />
            <Root.Screen
              name="GroupSettings"
              component={GroupSettingsScreen}
              options={{ title: 'Group settings' }}
            />
            <Root.Screen
              name="AddGroupMembers"
              layout={modalLayout}
              component={AddGroupMembersScreen}
              options={{ presentation: 'modal', title: 'Add people' }}
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
