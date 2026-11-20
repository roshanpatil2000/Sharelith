import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithTheme } from '@/test/render';
import { receiptPath } from '../receipts';
import { ReceiptSection } from '../components/ReceiptSection';

const mockNavigate = jest.fn();
const mockIsPro = jest.fn(() => false);
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../pro', () => ({ useIsPro: () => mockIsPro() }));
jest.mock('@/lib/supabase', () => ({
  supabase: require('@/test/supabaseMock').supabaseMock,
}));
const mockLaunch = jest.fn(async () => ({ didCancel: true }));
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: () => mockLaunch(),
}));

const renderSection = (path: string | null = null) =>
  renderWithTheme(
    <QueryClientProvider client={new QueryClient()}>
      <ReceiptSection expenseId="e1" path={path} />
    </QueryClientProvider>,
  );

it('names receipt files under their expense', () => {
  expect(receiptPath('e1', 'image/png', 5)).toBe('e1/receipt-5.png');
  expect(receiptPath('e1', undefined, 5)).toBe('e1/receipt-5.jpg');
});

it('sends free users to Pro instead of the photo picker', async () => {
  mockIsPro.mockReturnValue(false);
  await renderSection();
  expect(
    screen.getByText('Receipt photos are part of Sharelith Pro.'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('receipt-add'));
  expect(mockNavigate).toHaveBeenCalledWith('Pro');
  expect(mockLaunch).not.toHaveBeenCalled();
});

it('lets Pro users pick a photo', async () => {
  mockIsPro.mockReturnValue(true);
  await renderSection();
  await fireEvent.press(screen.getByTestId('receipt-add'));
  expect(mockLaunch).toHaveBeenCalled();
});
