import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, Moon, Sun, SunMoon } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Appear, Divider, Icon, ListRow, Screen } from '@/components';
import { useSettingsStore } from '@/lib/settingsStore';

const choices = [
  { value: 'light', title: 'Light', icon: Sun },
  { value: 'dark', title: 'Dark', icon: Moon },
  {
    value: 'system',
    title: 'System',
    icon: SunMoon,
    subtitle: 'Follows your phone’s setting',
  },
] as const;

export function AppearanceScreen() {
  const styles = useStyles(createStyles);
  const preference = useSettingsStore(s => s.themePreference);
  const setPreference = useSettingsStore(s => s.setThemePreference);
  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Appear>
        <View style={styles.card}>
          {choices.map((choice, index) => (
            <React.Fragment key={choice.value}>
              {index ? <Divider inset={52} /> : null}
              <ListRow
                title={choice.title}
                subtitle={'subtitle' in choice ? choice.subtitle : undefined}
                leading={<Icon icon={choice.icon} color="textSecondary" />}
                trailing={
                  preference === choice.value ? (
                    <Icon icon={Check} color="primary" />
                  ) : null
                }
                onPress={() => setPreference(choice.value)}
                testID={`theme-${choice.value}`}
              />
            </React.Fragment>
          ))}
        </View>
      </Appear>
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      overflow: 'hidden',
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surface,
    },
  });
