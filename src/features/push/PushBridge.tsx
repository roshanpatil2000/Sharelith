import { useEffect } from 'react';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '@/app/navigation/types';
import { toast } from '@/components';
import { listenForPushes, startPush, type PushTarget } from './push';

type Props = {
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>;
};

export function openTarget(
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>,
  target: PushTarget,
) {
  switch (target.screen) {
    case 'ExpenseDetail':
      navigation.navigate('ExpenseDetail', { expenseId: target.expenseId });
      break;
    case 'FriendDetail':
      navigation.navigate('FriendDetail', { friendId: target.friendId });
      break;
    case 'GroupDetail':
      navigation.navigate('GroupDetail', { groupId: target.groupId });
      break;
    default:
      navigation.navigate('Main', { screen: 'Activity' });
  }
}

/** While signed in: registers this device and opens tapped notifications. */
export function PushBridge({ navigation }: Props) {
  useEffect(() => startPush(), []);

  useEffect(() => {
    let pending: PushTarget | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const open = (target: PushTarget) => {
      if (navigation.isReady()) {
        openTarget(navigation, target);
        return;
      }
      // Opened from a notification at launch: wait for the navigator.
      pending = target;
      timer ??= setInterval(() => {
        if (pending && navigation.isReady()) {
          openTarget(navigation, pending);
          pending = null;
          clearInterval(timer!);
          timer = null;
        }
      }, 100);
    };
    const stop = listenForPushes({
      open,
      foreground: (title, body) => toast.show(body || title),
    });
    return () => {
      stop();
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [navigation]);

  return null;
}
