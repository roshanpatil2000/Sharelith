import { useEffect, useState } from 'react';
import { toast } from '@/components';
import { useSettingsStore } from '@/lib/settingsStore';
import {
  authenticate,
  biometryLabel,
  getBiometricSupport,
  type BiometricSupport,
} from './biometrics';

/** State and handler for the App lock switch in Account settings. */
export function useAppLockToggle() {
  const enabled = useSettingsStore(s => s.appLockEnabled);
  const setEnabled = useSettingsStore(s => s.setAppLockEnabled);
  const [support, setSupport] = useState<BiometricSupport>({
    available: false,
  });

  useEffect(() => {
    getBiometricSupport().then(setSupport);
  }, []);

  const toggle = async (next: boolean) => {
    // Prove the user can unlock before turning the lock on (or off).
    const ok = await authenticate(
      next ? 'Turn on app lock' : 'Turn off app lock',
    );
    if (ok) {
      setEnabled(next);
    } else {
      toast.show('Authentication cancelled');
    }
  };

  const label = biometryLabel(support.type);
  return {
    enabled,
    available: support.available,
    toggle,
    subtitle: support.available
      ? `Require ${label} to open Sharelith`
      : 'Set up Face ID or fingerprint on this device to use app lock',
  };
}
