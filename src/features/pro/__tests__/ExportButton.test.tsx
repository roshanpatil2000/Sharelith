import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithTheme } from '@/test/render';
import { ExportButton } from '../components/ExportButton';

const mockNavigate = jest.fn();
const mockIsPro = jest.fn(() => false);
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../pro', () => ({ useIsPro: () => mockIsPro() }));
jest.mock('@/features/expenses/api', () => ({
  useExpenses: () => ({ data: [] }),
}));

const renderButton = () =>
  renderWithTheme(
    <QueryClientProvider client={new QueryClient()}>
      <ExportButton title="Goa trip" groupId="g1" nameOf={() => 'You'} />
    </QueryClientProvider>,
  );

it('sends free users to the Pro screen', async () => {
  mockIsPro.mockReturnValue(false);
  await renderButton();
  await fireEvent.press(screen.getByTestId('export-button'));
  expect(mockNavigate).toHaveBeenCalledWith('Pro');
});

it('offers CSV or PDF to Pro users', async () => {
  mockIsPro.mockReturnValue(true);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderButton();
  await fireEvent.press(screen.getByTestId('export-button'));
  const buttons = alert.mock.calls[0]?.[2]?.map(b => b.text);
  expect(buttons).toEqual(['CSV (spreadsheet)', 'PDF', 'Cancel']);
});
