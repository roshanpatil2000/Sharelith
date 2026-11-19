import React, { useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { env } from '@/lib/env';
import { showAdChoices, useAdsStore } from '@/features/ads/ads';
import {
  Clock,
  KeyRound,
  LogOut,
  Palette,
  Pencil,
  ScanFace,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import {
  Avatar,
  Box,
  ConfirmDialog,
  CurrencyPicker,
  Divider,
  ErrorView,
  Icon,
  ListRow,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  SelectField,
  Skeleton,
  Stack,
  Switch,
  Text,
  toast,
} from '@/components';
import { timezoneLabel, timezoneOptions } from '@/domain/timezones';
import { signOut } from '@/features/auth/api';
import { toAppError } from '@/features/auth/errors';
import { useAppLockToggle } from '@/features/lock/useAppLockToggle';
import { useSettingsStore, type ThemePreference } from '@/lib/settingsStore';
import { useProfile, useUpdateProfile } from '../api';
import { VerifyEmailBanner } from '../components/VerifyEmailBanner';

const themeSegments = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

function ProfileHeader() {
  const {
    data: profile,
    isLoading,
    isError,
    errorUpdatedAt,
    refetch,
  } = useProfile();
  // A query with no data goes back to loading on every retry. Keep the error
  // up meanwhile: swapping it for the shorter skeleton moves every row below.
  if (isError || (!profile && errorUpdatedAt > 0)) {
    return <ErrorView onRetry={refetch} />;
  }
  if (isLoading || !profile) {
    return (
      <Row gap="lg" p="lg">
        <Skeleton circle height={56} />
        <Stack flex={1} gap="xs">
          <Skeleton width="50%" height={20} />
          <Skeleton width="70%" />
        </Stack>
      </Row>
    );
  }
  return (
    <Row gap="lg" p="lg">
      <Avatar name={profile.full_name} uri={profile.avatar_url} size="lg" />
      <Stack flex={1} gap="xxs">
        <Text variant="title" numberOfLines={1}>
          {profile.full_name}
        </Text>
        <Text color="textSecondary" numberOfLines={1}>
          {profile.email}
        </Text>
      </Stack>
    </Row>
  );
}

export function AccountScreen() {
  const navigation = useNavigation();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const themePreference = useSettingsStore(s => s.themePreference);
  const setThemePreference = useSettingsStore(s => s.setThemePreference);
  const appLock = useAppLockToggle();
  const [confirmLogout, setConfirmLogout] = useState(false);
  // Shown where the law requires a way to change ad consent (EU/UK).
  const adChoices = useAdsStore(s => s.privacyOptionsRequired);
  const [busy, setBusy] = useState(false);

  const zoneOptions = useMemo(
    () =>
      timezoneOptions(profile?.timezone).map(z => ({
        value: z,
        label: timezoneLabel(z),
      })),
    [profile?.timezone],
  );

  const save = (patch: Parameters<typeof updateProfile.mutate>[0]) =>
    updateProfile.mutate(patch, {
      onError: e => toast.show(toAppError(e).message, 'error'),
    });

  const logOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      toast.show(toAppError(e).message, 'error');
      setBusy(false);
      setConfirmLogout(false);
    }
  };

  return (
    <Screen scroll>
      <ProfileHeader />
      <VerifyEmailBanner />
      <ListRow
        title="Edit profile"
        leading={<Icon icon={Pencil} color="textSecondary" />}
        chevron
        onPress={() => navigation.navigate('EditProfile')}
        testID="account-edit-profile"
      />

      <SectionHeader title="Preferences" />
      {profile ? (
        <>
          <CurrencyPicker
            value={profile.default_currency}
            onChange={code => save({ default_currency: code })}
            testID="account-currency"
          />
          <Divider inset={52} />
          <SelectField
            label="Time zone"
            icon={Clock}
            value={profile.timezone}
            options={zoneOptions}
            onChange={timezone => save({ timezone })}
            searchable
            testID="account-timezone"
          />
          <Divider inset={52} />
        </>
      ) : null}
      <Stack gap="sm" px="lg" py="md" bg="surface">
        <Row gap="md">
          <Icon icon={Palette} color="textSecondary" />
          <Text variant="bodyStrong">Theme</Text>
        </Row>
        <SegmentedControl<ThemePreference>
          segments={themeSegments}
          value={themePreference}
          onChange={setThemePreference}
          testID="theme-control"
        />
      </Stack>

      <SectionHeader title="Security" />
      <ListRow
        title="App lock"
        subtitle={appLock.subtitle}
        leading={<Icon icon={ScanFace} color="textSecondary" />}
        trailing={
          <Switch
            value={appLock.enabled}
            onValueChange={appLock.toggle}
            disabled={!appLock.available}
            accessibilityLabel="App lock"
            testID="account-app-lock"
          />
        }
        // Tapping anywhere on the row toggles too, like iOS Settings.
        onPress={
          appLock.available ? () => appLock.toggle(!appLock.enabled) : undefined
        }
        testID="account-app-lock-row"
      />
      <Divider inset={52} />
      <ListRow
        title="Change password"
        leading={<Icon icon={KeyRound} color="textSecondary" />}
        chevron
        onPress={() => navigation.navigate('ChangePassword')}
      />

      <SectionHeader title="About" />
      <ListRow
        title="Privacy policy"
        leading={<Icon icon={ShieldCheck} color="textSecondary" />}
        chevron
        onPress={() => Linking.openURL(env.privacyPolicyUrl)}
        testID="account-privacy"
      />
      <Divider inset={52} />
      <ListRow
        title="Terms & Conditions"
        leading={<Icon icon={ScrollText} color="textSecondary" />}
        chevron
        onPress={() => Linking.openURL(env.termsUrl)}
        testID="account-terms"
      />
      {adChoices ? (
        <>
          <Divider inset={52} />
          <ListRow
            title="Ad choices"
            subtitle="Change how ads use your data"
            leading={<Icon icon={Megaphone} color="textSecondary" />}
            chevron
            onPress={() => showAdChoices().catch(() => {})}
            testID="account-ad-choices"
          />
        </>
      ) : null}

      <SectionHeader title="Account" />
      <ListRow
        title="Log out"
        leading={<Icon icon={LogOut} color="danger" />}
        onPress={() => setConfirmLogout(true)}
        testID="account-logout"
      />
      <Divider inset={52} />
      <ListRow
        title="Delete account"
        leading={<Icon icon={Trash2} color="danger" />}
        onPress={() => navigation.navigate('DeleteAccount')}
        testID="account-delete"
      />
      <Box p="xxl" />

      <ConfirmDialog
        visible={confirmLogout}
        title="Log out?"
        confirmLabel="Log out"
        destructive
        loading={busy}
        onConfirm={logOut}
        onCancel={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}
