import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useIsPro } from './pro';

/**
 * Wraps a Pro-only action: runs it for Pro users, opens the Pro screen for
 * everyone else. The server checks again (require_pro), so this is only UX.
 */
export function useProGate() {
  const isPro = useIsPro();
  const navigation = useNavigation();
  return useCallback(
    (action: () => void) => () => {
      if (isPro) {
        action();
      } else {
        navigation.navigate('Pro');
      }
    },
    [isPro, navigation],
  );
}
