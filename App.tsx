import React from 'react';
import { AppProviders } from '@/app/AppProviders';
import { RootNavigator } from '@/app/navigation/RootNavigator';
import { ForceUpdateGate } from '@/features/update/ForceUpdateGate';

export default function App() {
  return (
    <AppProviders>
      <ForceUpdateGate>
        <RootNavigator />
      </ForceUpdateGate>
    </AppProviders>
  );
}
