import React from 'react';
import { AppProviders } from '@/app/AppProviders';
import { RootNavigator } from '@/app/navigation/RootNavigator';

export default function App() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
