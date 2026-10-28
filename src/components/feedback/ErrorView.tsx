import React from 'react';
import { CircleAlert } from 'lucide-react-native';
import { EmptyState } from '../display/EmptyState';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorView({
  message = 'Please check your connection and try again.',
  onRetry,
}: Props) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Something went wrong"
      message={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}
