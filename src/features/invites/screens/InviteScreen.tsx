import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Share from 'react-native-share';
import { Share2 } from 'lucide-react-native';
import type { RootStackParamList } from '@/app/navigation/types';
import { useTheme } from '@/app/theme';
import {
  Box,
  Button,
  ErrorView,
  Screen,
  Skeleton,
  Stack,
  Text,
} from '@/components';
import { useGroup } from '@/features/groups/api';
import { useInviteLink } from '../api';
import { inviteMessage } from '../sms';

type Props = NativeStackScreenProps<RootStackParamList, 'Invite'>;

/** A QR code and share link that befriends you, or joins a group you run. */
export function InviteScreen({ route }: Props) {
  const theme = useTheme();
  const groupId = route.params?.groupId;
  const { data: group } = useGroup(groupId ?? '');
  const { data: url, isError, refetch } = useInviteLink(groupId);

  if (isError) {
    return <ErrorView onRetry={refetch} />;
  }

  const message = inviteMessage(
    url ?? '',
    groupId ? group?.name ?? '' : undefined,
  );

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg" align="center">
        <Text color="textSecondary" align="center">
          {groupId
            ? `Anyone who scans this or opens the link joins ${
                group?.name ?? 'the group'
              } and becomes your friend.`
            : 'Anyone who scans this or opens the link becomes your friend on Sharelith.'}
        </Text>
        <Box p="lg" radius="lg" style={styles.qr} testID="invite-qr">
          {url ? (
            <QRCode
              value={url}
              size={220}
              color="#000000"
              backgroundColor="#FFFFFF"
            />
          ) : (
            <Skeleton width={220} height={220} />
          )}
        </Box>
        {url ? (
          <Text
            variant="caption"
            color="textSecondary"
            align="center"
            selectable
            testID="invite-url"
          >
            {url}
          </Text>
        ) : null}
        <Text variant="caption" color="textSecondary" align="center">
          The link works for 30 days.
        </Text>
        <Button
          title="Share link"
          icon={Share2}
          size="lg"
          fullWidth
          disabled={!url}
          onPress={() =>
            Share.open({ message, failOnCancel: false }).catch(() => {})
          }
          testID="invite-share"
        />
      </Stack>
      <Box style={{ height: theme.spacing.lg }} />
    </Screen>
  );
}

// A QR code needs dark on light to scan, whatever the app's theme.
const styles = StyleSheet.create({ qr: { backgroundColor: '#FFFFFF' } });
