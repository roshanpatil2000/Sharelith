import React, { useState } from 'react';
import { Receipt } from 'lucide-react-native';
import { AmountInput, Banner, Screen, Stack, TextField } from '@/components';

/** Placeholder shell; the full add-expense flow is built in Phase 4. */
export function AddExpenseScreen() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);

  return (
    <Screen scroll padded>
      <Stack gap="xl">
        <Banner
          tone="info"
          message="Splitting and saving expenses arrive in Phase 4."
        />
        <TextField
          label="Description"
          placeholder="Enter a description"
          leadingIcon={Receipt}
          value={description}
          onChangeText={setDescription}
        />
        <AmountInput value={amount} currency="INR" onChange={setAmount} />
      </Stack>
    </Screen>
  );
}
