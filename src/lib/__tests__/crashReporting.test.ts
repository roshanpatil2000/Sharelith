describe('crash reporting', () => {
  const crashlytics = {
    getCrashlytics: jest.fn(() => 'c'),
    setUserId: jest.fn(async () => null),
    log: jest.fn(),
    recordError: jest.fn(),
  };

  function load(os: 'android' | 'ios') {
    jest.resetModules();
    jest.doMock('react-native', () => {
      const rn = jest.requireActual('react-native');
      rn.Platform.OS = os;
      return rn;
    });
    jest.doMock('@react-native-firebase/crashlytics', () => crashlytics);
    return require('../crashReporting') as typeof import('../crashReporting');
  }

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.dontMock('react-native'));

  it('tags reports with the account id, and clears it on sign-out', () => {
    const { setCrashUser } = load('android');
    setCrashUser('user-1');
    setCrashUser(null);
    expect(crashlytics.setUserId.mock.calls).toEqual([
      ['c', 'user-1'],
      ['c', ''],
    ]);
  });

  it('records caught errors with what was happening', () => {
    const { reportError } = load('android');
    reportError('boom', 'Push registration failed');
    expect(crashlytics.log).toHaveBeenCalledWith(
      'c',
      'Push registration failed',
    );
    expect(crashlytics.recordError).toHaveBeenCalledWith(
      'c',
      new Error('boom'),
    );
  });

  it('does nothing on iOS, where Firebase is not linked', () => {
    const { reportError, setCrashUser } = load('ios');
    setCrashUser('user-1');
    reportError(new Error('boom'));
    expect(crashlytics.setUserId).not.toHaveBeenCalled();
    expect(crashlytics.recordError).not.toHaveBeenCalled();
  });
});
