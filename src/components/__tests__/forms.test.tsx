import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { renderWithTheme } from '@/test/render';
import { Button, CurrencyPicker, FormTextField, SelectField } from '..';

const schema = z.object({ email: z.email('Enter a valid email address') });

function EmailForm({ onValid }: { onValid: (v: { email: string }) => void }) {
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });
  return (
    <>
      <FormTextField
        control={control}
        name="email"
        label="Email"
        testID="email"
      />
      <Button title="Submit" onPress={handleSubmit(onValid)} />
    </>
  );
}

describe('FormTextField', () => {
  it('shows the schema error, then submits once valid', async () => {
    const onValid = jest.fn();
    await renderWithTheme(<EmailForm onValid={onValid} />);

    await fireEvent.changeText(screen.getByTestId('email'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeOnTheScreen();
    expect(onValid).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('email'), 'a@b.co');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(onValid.mock.calls[0]?.[0]).toEqual({ email: 'a@b.co' });
  });

  it('toggles password visibility', async () => {
    function PasswordForm() {
      const { control } = useForm({ defaultValues: { pw: 'secret' } });
      return (
        <FormTextField
          control={control}
          name="pw"
          label="Password"
          password
          testID="pw"
        />
      );
    }
    await renderWithTheme(<PasswordForm />);
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(true);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Show password' }),
    );
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(false);
  });
});

describe('SelectField', () => {
  const options = [
    { value: 'a', label: 'Apple', description: 'Fruit' },
    { value: 'b', label: 'Bread', description: 'Bakery' },
  ] as const;

  it('shows the current label and reports a new choice', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <SelectField
        label="Food"
        value="a"
        options={options}
        onChange={onChange}
        testID="food"
      />,
    );
    expect(screen.getAllByText('Apple').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('food-option-b'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('filters options by search text, including descriptions', async () => {
    await renderWithTheme(
      <SelectField
        label="Food"
        value="a"
        options={options}
        onChange={jest.fn()}
        searchable
        testID="food"
      />,
    );
    await fireEvent.changeText(screen.getByTestId('food-search'), 'baker');
    expect(screen.getByTestId('food-option-b')).toBeOnTheScreen();
    expect(screen.queryByTestId('food-option-a')).toBeNull();
  });

  it('says so when nothing matches', async () => {
    await renderWithTheme(
      <SelectField
        label="Food"
        value="a"
        options={options}
        onChange={jest.fn()}
        searchable
        testID="food"
      />,
    );
    await fireEvent.changeText(screen.getByTestId('food-search'), 'zzz');
    expect(screen.getByText('No matches for “zzz”')).toBeOnTheScreen();
    expect(screen.queryByTestId('food-option-a')).toBeNull();
  });
});

describe('CurrencyPicker', () => {
  it('finds a currency by name and selects its code', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <CurrencyPicker value="INR" onChange={onChange} testID="cur" />,
    );
    await fireEvent.changeText(screen.getByTestId('cur-search'), 'dirham');
    await fireEvent.press(screen.getByTestId('cur-option-AED'));
    expect(onChange).toHaveBeenCalledWith('AED');
  });
});
