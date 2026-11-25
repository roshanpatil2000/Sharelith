import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessageCircle, MessageSquare, Phone, User } from 'lucide-react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import {
  Button,
  ErrorView,
  Screen,
  Stack,
  Text,
  TextField,
} from '@/components';
import { useInviteLink } from '../api';
import { normalizePhone } from '../contacts';
import { inviteMessage, openOrShare, smsUrl, whatsappUrl } from '../sms';

type Props = NativeStackScreenProps<RootStackParamList, 'InviteByPhone'>;

/**
 * Invite someone by phone: your SMS app (or WhatsApp) opens with your invite
 * link typed in, and you send it. Once they open it, you're friends.
 */
export function InviteByPhoneScreen({ route }: Props) {
  const [name, setName] = useState(route.params?.name ?? '');
  const [number, setNumber] = useState(route.params?.phone ?? '');
  const [touched, setTouched] = useState(false);
  const { data: url, isError, refetch } = useInviteLink();

  if (isError) {
    return <ErrorView onRetry={refetch} />;
  }

  const phone = normalizePhone(number);
  const error = touched && !phone ? 'Enter a valid phone number' : undefined;
  const first = name.trim().split(' ')[0];
  const message = url
    ? (first ? `Hi ${first}! ` : '') + inviteMessage(url)
    : '';

  const send = (to: (p: string, body: string) => string) => {
    setTouched(true);
    if (phone && url) {
      openOrShare(to(phone, message), message);
    }
  };

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        <Text color="textSecondary">
          Your messages app opens with an invite link typed in: just tap send.
          When they open the link and join, you’re friends on Sharelith.
        </Text>
        <TextField
          label="Their name (optional)"
          leadingIcon={User}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          testID="invite-phone-name"
        />
        <TextField
          label="Phone number"
          leadingIcon={Phone}
          value={number}
          onChangeText={setNumber}
          onBlur={() => setTouched(true)}
          keyboardType="phone-pad"
          autoComplete="tel"
          helper="Indian numbers can skip +91"
          error={error}
          testID="invite-phone-number"
        />
        <Button
          title="Send SMS"
          icon={MessageSquare}
          size="lg"
          fullWidth
          disabled={!url}
          onPress={() => send(smsUrl)}
          testID="invite-phone-sms"
        />
        <Button
          title="Send on WhatsApp"
          icon={MessageCircle}
          variant="secondary"
          fullWidth
          disabled={!url}
          onPress={() => send(whatsappUrl)}
          testID="invite-phone-whatsapp"
        />
      </Stack>
    </Screen>
  );
}
