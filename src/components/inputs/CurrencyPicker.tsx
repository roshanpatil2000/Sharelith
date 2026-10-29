import React, { useMemo } from 'react';
import { Coins } from 'lucide-react-native';
import { currencies, currencyLabel } from '@/domain/currencies';
import { SelectField, type SelectOption } from './SelectField';

type Props = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  testID?: string;
};

/** Searchable currency chooser showing "INR" with "₹ Indian Rupee". */
export function CurrencyPicker({
  value,
  onChange,
  label = 'Default currency',
  testID,
}: Props) {
  const options = useMemo<SelectOption<string>[]>(
    () =>
      currencies.map(c => ({
        value: c.code,
        label: c.code,
        description: currencyLabel(c.code),
      })),
    [],
  );
  return (
    <SelectField
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      icon={Coins}
      searchable
      testID={testID}
    />
  );
}
