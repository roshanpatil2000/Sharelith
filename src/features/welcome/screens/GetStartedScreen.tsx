import React from 'react';
import { StyleSheet, View } from 'react-native';
import { House, Plane } from 'lucide-react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { Appear, Button, Screen, Text } from '@/components';
import { useAuthStore } from '@/features/auth/authStore';
import { Burst } from '../components/Burst';

/** After the welcome pages: what to set up first. */
export function GetStartedScreen() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const finish = useAuthStore(s => s.finishSetup);
  return (
    <Screen
      scroll
      padded
      edges={['top', 'bottom', 'left', 'right']}
      contentStyle={styles.content}
      background={colors.welcomeTogether}
      testID="get-started"
    >
      <View style={styles.top}>
        <Burst />
        <Appear delay={120}>
          <Text variant="display" accessibilityRole="header">
            Where shall we begin?
          </Text>
        </Appear>
        <Appear delay={200}>
          <Text color="textSecondary" style={styles.body}>
            Make a group for the people you share costs with. You can always add
            more later.
          </Text>
        </Appear>
      </View>
      <View style={styles.actions}>
        <Appear delay={280}>
          <Button
            title="Plan a trip"
            icon={Plane}
            size="lg"
            fullWidth
            onPress={() => finish('trip')}
            testID="setup-trip"
          />
        </Appear>
        <Appear delay={360}>
          <Button
            title="Share a home"
            icon={House}
            size="lg"
            fullWidth
            onPress={() => finish('home')}
            testID="setup-home"
          />
        </Appear>
        <Appear delay={440}>
          <Button
            title="I’ll look around first"
            variant="link"
            size="lg"
            fullWidth
            onPress={() => finish(null)}
            testID="setup-skip"
          />
        </Appear>
      </View>
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    content: {
      flexGrow: 1,
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.xxl,
    },
    top: { gap: t.spacing.md },
    body: { fontSize: 17, lineHeight: 24 },
    actions: { gap: t.spacing.md, paddingTop: t.spacing.xxxl },
  });
