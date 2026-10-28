import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { LayoutGrid, LogOut, Palette } from 'lucide-react-native';
import {
  Avatar,
  Banner,
  Box,
  Divider,
  Icon,
  ListRow,
  Row,
  Screen,
  SectionHeader,
  SegmentedControl,
  Stack,
  Text,
} from '@/components';
import { isSupabaseConfigured } from '@/lib/env';
import { useSessionStore } from '@/lib/sessionStore';
import { useSettingsStore, type ThemePreference } from '@/lib/settingsStore';

const themeSegments = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export function AccountScreen() {
  const navigation = useNavigation();
  const signOut = useSessionStore(s => s.signOut);
  const themePreference = useSettingsStore(s => s.themePreference);
  const setThemePreference = useSettingsStore(s => s.setThemePreference);

  return (
    <Screen scroll>
      <Row gap="lg" p="lg">
        <Avatar name="Dev User" size="lg" />
        <Stack flex={1} gap="xxs">
          <Text variant="title">Dev User</Text>
          <Text color="textSecondary">Profile arrives in Phase 1</Text>
        </Stack>
      </Row>

      {!isSupabaseConfigured ? (
        <Box px="lg" py="sm">
          <Banner
            tone="warning"
            message="Supabase is not configured. Copy .env.example to .env and add your keys."
          />
        </Box>
      ) : null}

      <SectionHeader title="Preferences" />
      <Stack gap="sm" p="lg">
        <Row gap="sm">
          <Icon icon={Palette} size={18} color="textSecondary" />
          <Text variant="bodyStrong">Theme</Text>
        </Row>
        <SegmentedControl<ThemePreference>
          segments={themeSegments}
          value={themePreference}
          onChange={setThemePreference}
          testID="theme-control"
        />
      </Stack>

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
        </>
      ) : null}

      <Divider />
      <ListRow
        title="Log out"
        leading={<Icon icon={LogOut} color="danger" />}
        onPress={signOut}
      />
    </Screen>
  );
}
