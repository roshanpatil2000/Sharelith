import React, { useState } from 'react';
import { Linking, Modal, StyleSheet, View } from 'react-native';
import { ScrollText } from 'lucide-react-native';
import { Button, Icon, Stack, Text, toast } from '@/components';
import { env } from '@/lib/env';
import { useTheme } from '@/app/theme';
import { acceptTerms, needsTermsConsent, signOut } from '../api';
import { useAuthStore } from '../authStore';
import { toAppError } from '../errors';

/**
 * Asks anyone who hasn't agreed to the current Terms and Privacy Policy
 * (accounts made before the sign-up checkbox, invited people, or after the
 * documents change) to agree before using the app.
 */
export function TermsPrompt() {
  const theme = useTheme();
  const user = useAuthStore(s => s.session?.user);
  const [busy, setBusy] = useState<'accept' | 'logout' | null>(null);

  if (!user || !needsTermsConsent(user)) {
    return null;
  }

  const run = async (kind: 'accept' | 'logout') => {
    setBusy(kind);
    try {
      await (kind === 'accept' ? acceptTerms() : signOut());
    } catch (e) {
      toast.show(toAppError(e).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <Stack gap="lg" p="xl" style={styles.body}>
          <Icon icon={ScrollText} color="primary" size={40} />
          <Text variant="title">Please review our terms</Text>
          <Text color="textSecondary">
            To keep using Sharelith, please agree to our{' '}
            <Text
              color="primary"
              onPress={() => Linking.openURL(env.termsUrl)}
              accessibilityRole="link"
              testID="terms-prompt-terms"
            >
              Terms & Conditions
            </Text>{' '}
            and{' '}
            <Text
              color="primary"
              onPress={() => Linking.openURL(env.privacyPolicyUrl)}
              accessibilityRole="link"
              testID="terms-prompt-privacy"
            >
              Privacy Policy
            </Text>
            . They explain how we use analytics, show ads, and handle your data.
          </Text>
          <Button
            title="I agree"
            onPress={() => run('accept')}
            loading={busy === 'accept'}
            disabled={busy !== null}
            testID="terms-prompt-accept"
          />
          <Button
            title="Log out"
            variant="ghost"
            onPress={() => run('logout')}
            loading={busy === 'logout'}
            disabled={busy !== null}
            testID="terms-prompt-logout"
          />
        </Stack>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center' },
  body: { maxWidth: 480, width: '100%', alignSelf: 'center' },
});
