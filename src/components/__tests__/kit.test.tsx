import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { Users } from 'lucide-react-native';
import { darkColors, lightColors } from '@/app/theme';
import { renderWithTheme } from '@/test/render';
import {
  AmountInput,
  AmountText,
  BalanceSummary,
  Button,
  Checkbox,
  EmptyState,
  ListRow,
  SegmentedControl,
  TextField,
  initials,
} from '..';

describe('Button', () => {
  it('fires onPress', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button title="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled or loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await renderWithTheme(
      <Button title="Save" onPress={onPress} disabled />,
    );
    await fireEvent.press(screen.getByRole('button'));
    await rerender(<Button title="Save" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('AmountText', () => {
  it('colors positive amounts green and hides the sign', async () => {
    await renderWithTheme(
      <AmountText minor={12050} currency="INR" testID="amt" />,
    );
    const el = screen.getByTestId('amt');
    expect(el).toHaveTextContent('₹120.50');
    expect(el).toHaveStyle({ color: lightColors.positive });
  });

  it('colors negative amounts orange', async () => {
    await renderWithTheme(
      <AmountText minor={-500} currency="INR" testID="amt" />,
    );
    expect(screen.getByTestId('amt')).toHaveStyle({
      color: lightColors.negative,
    });
  });

  it('uses dark palette in dark mode', async () => {
    await renderWithTheme(
      <AmountText minor={0} currency="INR" testID="amt" />,
      {
        scheme: 'dark',
      },
    );
    expect(screen.getByTestId('amt')).toHaveStyle({
      color: darkColors.neutral,
    });
  });
});

describe('BalanceSummary', () => {
  it('shows settled up when all balances are zero', async () => {
    await renderWithTheme(
      <BalanceSummary balances={[{ currency: 'INR', minor: 0 }]} />,
    );
    expect(screen.getByText('You are all settled up')).toBeOnTheScreen();
  });

  it('renders one line per currency', async () => {
    await renderWithTheme(
      <BalanceSummary
        balances={[
          { currency: 'INR', minor: 120000 },
          { currency: 'USD', minor: -2000 },
        ]}
      />,
    );
    expect(screen.getByText(/you are owed/)).toBeOnTheScreen();
    expect(screen.getByText(/you owe/)).toBeOnTheScreen();
  });
});

describe('Avatar initials', () => {
  it.each([
    ['Roshan Patil', 'RP'],
    ['alex', 'A'],
    ['  Mary Jane Watson ', 'MW'],
    ['', '?'],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('Checkbox', () => {
  it('toggles', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <Checkbox checked={false} onChange={onChange} label="Include Alex" />,
    );
    await fireEvent.press(
      screen.getByRole('checkbox', { name: 'Include Alex' }),
    );
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('SegmentedControl', () => {
  it('reports the selected segment', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <SegmentedControl
        segments={[
          { value: 'equal', label: 'Equally' },
          { value: 'exact', label: 'Exact' },
        ]}
        value="equal"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Equally' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Exact' }));
    expect(onChange).toHaveBeenCalledWith('exact');
  });
});

describe('AmountInput', () => {
  it('reports minor units and rejects a third decimal', async () => {
    const onChange = jest.fn();
    await renderWithTheme(
      <AmountInput value={0} currency="INR" onChange={onChange} testID="amt" />,
    );
    const input = screen.getByTestId('amt');
    await fireEvent.changeText(input, '12.5');
    expect(onChange).toHaveBeenLastCalledWith(1250);
    await fireEvent.changeText(input, '12.555');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('TextField', () => {
  it('shows the error instead of helper text', async () => {
    await renderWithTheme(
      <TextField label="Email" helper="We never share it" error="Required" />,
    );
    expect(screen.getByText('Required')).toBeOnTheScreen();
    expect(screen.queryByText('We never share it')).toBeNull();
  });
});

describe('ListRow', () => {
  it('is pressable with an accessible label', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <ListRow
        title="Goa trip"
        subtitle="you are owed ₹500"
        onPress={onPress}
      />,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Goa trip, you are owed ₹500' }),
    );
    expect(onPress).toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('renders the call to action', async () => {
    const onAction = jest.fn();
    await renderWithTheme(
      <EmptyState
        icon={Users}
        title="No groups yet"
        actionLabel="Start a group"
        onAction={onAction}
      />,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Start a group' }),
    );
    expect(onAction).toHaveBeenCalled();
  });
});
