import { useEffect, useRef } from 'react';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '@/app/navigation/types';
import { toast } from '@/components';
import { toAppError } from '@/features/auth/errors';
import { redeemInvite, useAfterInvite } from './api';
import { useInviteStore } from './links';

type Props = {
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>;
};

/**
 * While signed in: uses an opened invite link (from now, or saved from
 * before signing up) and opens the friend or group it was for.
 */
export function InviteBridge({ navigation }: Props) {
  const token = useInviteStore(s => s.pendingToken);
  const afterInvite = useAfterInvite();
  const busy = useRef(false);

  useEffect(() => {
    if (!token || busy.current) {
      return;
    }
    busy.current = true;
    useInviteStore.getState().setPendingToken(null);
    redeemInvite(token)
      .then(async result => {
        await afterInvite();
        toast.show(
          result.already
            ? result.groupId
              ? 'You’re already in this group'
              : 'You’re already friends'
            : result.groupId
            ? 'You joined the group'
            : 'You’re now friends',
          'success',
        );
        const go = () =>
          result.groupId
            ? navigation.navigate('GroupDetail', { groupId: result.groupId })
            : navigation.navigate('FriendDetail', {
                friendId: result.friendId,
              });
        if (navigation.isReady()) {
          go();
        } else {
          const timer = setInterval(() => {
            if (navigation.isReady()) {
              clearInterval(timer);
              go();
            }
          }, 100);
        }
      })
      .catch(e => toast.show(toAppError(e).message, 'error'))
      .finally(() => {
        busy.current = false;
      });
  }, [token, afterInvite, navigation]);

  return null;
}
