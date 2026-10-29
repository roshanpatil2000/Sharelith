import ReactNativeBiometrics, {
  type BiometryType,
} from 'react-native-biometrics';

// Falls back to the device passcode when biometrics fail or aren't enrolled.
const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

export type BiometricSupport = {
  available: boolean;
  type?: BiometryType;
};

export async function getBiometricSupport(): Promise<BiometricSupport> {
  try {
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    return { available, type: biometryType };
  } catch {
    return { available: false };
  }
}

export function biometryLabel(type?: BiometryType): string {
  if (type === 'FaceID') {
    return 'Face ID';
  }
  if (type === 'TouchID') {
    return 'Touch ID';
  }
  return 'fingerprint';
}

/** Shows the system biometric prompt; resolves true on success. */
export async function authenticate(promptMessage: string): Promise<boolean> {
  try {
    const { success } = await rnBiometrics.simplePrompt({
      promptMessage,
      cancelButtonText: 'Cancel',
    });
    return success;
  } catch {
    return false;
  }
}
