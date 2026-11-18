import { targetFor } from '../push';

describe('targetFor', () => {
  it('opens the expense when there is one', () => {
    expect(targetFor({ expense_id: 'e1', group_id: 'g1' })).toEqual({
      screen: 'ExpenseDetail',
      expenseId: 'e1',
    });
  });

  it('opens the group you were added to', () => {
    expect(targetFor({ kind: 'member_added', group_id: 'g1' })).toEqual({
      screen: 'GroupDetail',
      groupId: 'g1',
    });
  });

  it('falls back to Activity, including a group you were removed from', () => {
    expect(targetFor({ kind: 'member_removed', group_id: 'g1' })).toEqual({
      screen: 'Activity',
    });
    expect(targetFor(undefined)).toEqual({ screen: 'Activity' });
  });
});

describe('on Android', () => {
  const messaging = {
    getMessaging: jest.fn(() => 'm'),
    getToken: jest.fn(async () => 'tok'),
    deleteToken: jest.fn(async () => {}),
    onTokenRefresh: jest.fn(() => () => {}),
  };
  const rpc = jest.fn(async () => ({ error: null }));

  function load() {
    jest.resetModules();
    jest.doMock('react-native', () => {
      const rn = jest.requireActual('react-native');
      rn.Platform.OS = 'android';
      rn.Platform.Version = 34;
      rn.PermissionsAndroid.request = jest.fn(async () => 'granted');
      return rn;
    });
    jest.doMock('@react-native-firebase/messaging', () => messaging, {
      virtual: false,
    });
    jest.doMock('@/lib/supabase', () => ({ supabase: { rpc } }));
    return require('../push') as typeof import('../push');
  }

  afterEach(() => jest.dontMock('react-native'));

  it('registers the token and removes it on sign-out', async () => {
    const push = load();
    const stop = push.startPush();
    await new Promise<void>(r => setTimeout(r, 0));
    await new Promise<void>(r => setTimeout(r, 0));
    expect(rpc).toHaveBeenCalledWith('register_push_token', {
      token: 'tok',
      platform: 'android',
    });
    expect(messaging.onTokenRefresh).toHaveBeenCalled();
    stop();

    await push.stopPush();
    expect(rpc).toHaveBeenCalledWith('unregister_push_token', { token: 'tok' });
    expect(messaging.deleteToken).toHaveBeenCalled();
  });
});
