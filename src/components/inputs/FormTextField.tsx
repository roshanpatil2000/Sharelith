import React, { useState } from 'react';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react-native';
import { TextField, type TextFieldProps } from './TextField';
import { IconButton } from './IconButton';

type Props<T extends FieldValues> = Omit<
  TextFieldProps,
  'value' | 'onChangeText' | 'onBlur' | 'error'
> & {
  control: Control<T>;
  name: Path<T>;
  /** Password field with a show/hide toggle. */
  password?: boolean;
};

/** TextField bound to react-hook-form; shows the field's validation error. */
export function FormTextField<T extends FieldValues>({
  control,
  name,
  password = false,
  ...rest
}: Props<T>) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...rest}
          ref={field.ref}
          value={field.value ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
          secureTextEntry={password && !revealed}
          autoCapitalize={password ? 'none' : rest.autoCapitalize}
          autoCorrect={password ? false : rest.autoCorrect}
          trailing={
            password ? (
              <IconButton
                icon={revealed ? EyeOff : Eye}
                size={18}
                color="textSecondary"
                accessibilityLabel={
                  revealed ? 'Hide password' : 'Show password'
                }
                onPress={() => setRevealed(r => !r)}
              />
            ) : (
              rest.trailing
            )
          }
        />
      )}
    />
  );
}
