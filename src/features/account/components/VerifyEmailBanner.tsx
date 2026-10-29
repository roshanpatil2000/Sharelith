import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Banner, Box } from '@/components';
import { useProfile } from '../api';

/** Nudge shown until the user confirms their email with a code. */
export function VerifyEmailBanner() {
  const navigation = useNavigation();
  const { data: profile } = useProfile();
  if (!profile || profile.email_verified_at) {
    return null;
  }
  return (
    <Box px="lg" py="sm">
      <Banner
        tone="warning"
        message="Confirm your email so friends can find you."
        actionLabel="Confirm"
        onAction={() => navigation.navigate('VerifyEmail')}
      />
    </Box>
  );
}
