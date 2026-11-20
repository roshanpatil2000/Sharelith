import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithTheme } from '@/test/render';
import { fakeSession, supabaseMock } from '@/test/supabaseMock';
import { TERMS_VERSION, needsTermsConsent } from '../api';
import { useAuthStore } from '../authStore';
import { TermsPrompt } from '../components/TermsPrompt';

jest.mock('@/lib/supabase', () => ({
  supabase: require('@/test/supabaseMock').supabaseMock,
}));

function signInWith(metadata: Record<string, unknown>) {
  const session = fakeSession();
  session.user.user_metadata = metadata;
  useAuthStore.setState({ session });
}

afterEach(() => useAuthStore.setState({ session: null }));

describe('needsTermsConsent', () => {
  it('is true for accounts that never agreed or agreed to older terms', () => {
    expect(needsTermsConsent({ user_metadata: {} })).toBe(true);
    expect(
      needsTermsConsent({ user_metadata: { terms_version: '2020-01-01' } }),
    ).toBe(true);
  });
  it('is false once they agreed to the current terms', () => {
    expect(
      needsTermsConsent({ user_metadata: { terms_version: TERMS_VERSION } }),
    ).toBe(false);
  });
});

it('stays hidden for people who already agreed', async () => {
  signInWith({ terms_version: TERMS_VERSION });
  await renderWithTheme(<TermsPrompt />);
  expect(screen.queryByText('Please review our terms')).toBeNull();
});

it('asks older accounts to agree and records it', async () => {
  signInWith({});
  await renderWithTheme(<TermsPrompt />);
  expect(screen.getByText('Please review our terms')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('terms-prompt-accept'));
  await waitFor(() =>
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({
      data: expect.objectContaining({ terms_version: TERMS_VERSION }),
    }),
  );
});
