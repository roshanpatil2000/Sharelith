import React from 'react';
import { Search, X } from 'lucide-react-native';
import { TextField, type TextFieldProps } from './TextField';
import { IconButton } from './IconButton';

type Props = Omit<TextFieldProps, 'leadingIcon' | 'trailing' | 'label'> & {
  value: string;
  onChangeText: (text: string) => void;
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  ...rest
}: Props) {
  return (
    <TextField
      {...rest}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      leadingIcon={Search}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="search"
      accessibilityRole="search"
      trailing={
        value ? (
          <IconButton
            icon={X}
            size={16}
            color="textSecondary"
            accessibilityLabel="Clear search"
            onPress={() => onChangeText('')}
          />
        ) : null
      }
    />
  );
}
