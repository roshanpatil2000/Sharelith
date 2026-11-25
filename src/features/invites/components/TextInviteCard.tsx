import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { MessageSquare, Send } from 'lucide-react-native';
import {
  Banner,
  Box,
  Button,
  Icon,
  Row,
  Stack,
  Text,
  toast,
} from '@/components';
import { toAppError } from '@/features/auth/errors';
import { useProfile } from '@/features/account/api';
import { useRemoteConfig } from '@/lib/remoteConfig';
import { useInviteLink } from '../api';
import { sendFromMyPhone, smsInviteText, useSmsInvite } from '../sms';

type Props = {
  name: string;
  phone: string;
  /** After Sharelith sent the text. */
  onSent: () => void;
};

/**
 * Invite a contact who has no email by text. Sharelith sends it (Twilio)
 * when Remote Config allows; your own Messages app is always an option.
 */
export function TextInviteCard({ name, phone, onSent }: Props) {
  const enabled = useRemoteConfig(s => s.sms_invites_enabled);
  const { data: link } = useInviteLink();
  const { data: profile } = useProfile();
  const invite = useSmsInvite();
  const [error, setError] = useState<string | null>(null);
  const first = name.split(' ')[0] || name;

  const send = async () => {
    setError(null);
    try {
      await invite.mutateAsync(phone);
      toast.show(`Invited ${first} by text`, 'success');
      onSent();
    } catch (e) {
      setError(toAppError(e).message);
    }
  };

  const fromPhone = () =>
    link &&
    sendFromMyPhone(
      phone,
      smsInviteText(profile?.full_name ?? 'A friend', link),
    );

  // Sharelith sends unless it's off or just failed; then your phone is the way.
  const phoneFirst = !enabled || !!error;

  return (
    <Box p="lg" radius="lg" bg="primarySoft" gap="md" testID="text-invite">
      <Row gap="sm">
        <Icon icon={MessageSquare} color="primary" />
        <Stack gap="xxs" style={styles.text}>
          <Text variant="bodyStrong">Invite {name} by text</Text>
          <Text color="textSecondary">{phone}</Text>
        </Stack>
      </Row>
      <Text color="textSecondary">
        They get your invite link. When they join, you’re friends.
      </Text>
      {error ? <Banner tone="danger" message={error} /> : null}
      {phoneFirst ? null : (
        <Button
          title="Send invite"
          icon={Send}
          fullWidth
          loading={invite.isPending}
          onPress={send}
          testID="text-invite-send"
        />
      )}
      <Button
        title="Send from my phone"
        icon={MessageSquare}
        variant={phoneFirst ? 'primary' : 'outline'}
        fullWidth
        disabled={!link}
        onPress={fromPhone}
        testID="text-invite-phone"
      />
    </Box>
  );
}

const styles = StyleSheet.create({ text: { flex: 1 } });
