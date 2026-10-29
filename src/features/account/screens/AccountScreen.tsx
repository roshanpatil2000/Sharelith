import React, { useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Clock,
  KeyRound,
  LayoutGrid,
  Mail,
  LogOut,
  Palette,
  Pencil,
  ScanFace,
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
import { deleteAccount, signOut } from '@/features/auth/api';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import { sendTestEmail } from '@/features/dev/api';
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
  const { data: profile, isLoading, isError, refetch } = useProfile();
  if (isError) {
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
  const userId = useUserId();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const themePreference = useSettingsStore(s => s.themePreference);
  const setThemePreference = useSettingsStore(s => s.setThemePreference);
  const appLock = useAppLockToggle();
  const [confirm, setConfirm] = useState<'logout' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const runTestEmail = async () => {
    setSendingTest(true);
    try {
      const to = await sendTestEmail();
      toast.show(`Test email sent to ${to}`, 'success');
    } catch (e) {
      toast.show(toAppError(e).message, 'error');
    } finally {
      setSendingTest(false);
    }
  };

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

  const runConfirmed = async () => {
    setBusy(true);
    try {
      if (confirm === 'delete' && userId) {
        await deleteAccount(userId);
      } else {
        await signOut();
      }
    } catch (e) {
      toast.show(toAppError(e).message, 'error');
      setBusy(false);
      setConfirm(null);
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

      {__DEV__ ? (
        <>
          <SectionHeader title="Developer" />
          <ListRow
            title="Component gallery"
            subtitle="Every design-system component, light and dark"
            leading={<Icon icon={LayoutGrid} color="primary" />}
            chevron
            onPress={() => navigation.navigate('ComponentGallery')}
          />
          <Divider inset={52} />
          <ListRow
            title="Send test email"
            subtitle="Mailtrap, to your own address"
            leading={<Icon icon={Mail} color="primary" />}
            trailing={sendingTest ? <ActivityIndicator /> : undefined}
            onPress={sendingTest ? undefined : runTestEmail}
            testID="account-test-email"
          />
        </>
      ) : null}

      <SectionHeader title="Account" />
      <ListRow
        title="Log out"
        leading={<Icon icon={LogOut} color="danger" />}
        onPress={() => setConfirm('logout')}
        testID="account-logout"
      />
      <Divider inset={52} />
      <ListRow
        title="Delete account"
        leading={<Icon icon={Trash2} color="danger" />}
        onPress={() => setConfirm('delete')}
        testID="account-delete"
      />
      <Box p="xxl" />

      <ConfirmDialog
        visible={confirm !== null}
        title={confirm === 'delete' ? 'Delete your account?' : 'Log out?'}
        message={
          confirm === 'delete'
            ? 'This permanently deletes your profile and can’t be undone.'
            : undefined
        }
        confirmLabel={confirm === 'delete' ? 'Delete account' : 'Log out'}
        destructive
        loading={busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}
