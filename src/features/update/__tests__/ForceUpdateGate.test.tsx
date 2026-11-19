import React from 'react';
import { Linking, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ForceUpdateGate } from '../ForceUpdateGate';
import { remoteDefaults, useRemoteConfig } from '@/lib/remoteConfig';

afterEach(() => useRemoteConfig.setState(remoteDefaults));

it('lets supported versions through', async () => {
  await render(
    <ForceUpdateGate>
      <Text>App</Text>
    </ForceUpdateGate>,
  );
  expect(screen.getByText('App')).toBeOnTheScreen();
});

it('blocks older versions and links to the update', async () => {
  useRemoteConfig.setState({
    min_supported_version: '99.0.0',
    update_url: 'https://example.com/get',
  });
  const openURL = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValue(undefined as never);
  await render(
    <ForceUpdateGate>
      <Text>App</Text>
    </ForceUpdateGate>,
  );
  expect(screen.getByText('Please update Sharelith')).toBeOnTheScreen();
  expect(screen.queryByText('App')).toBeNull();
  await fireEvent.press(screen.getByText('Update'));
  expect(openURL).toHaveBeenCalledWith('https://example.com/get');
});
