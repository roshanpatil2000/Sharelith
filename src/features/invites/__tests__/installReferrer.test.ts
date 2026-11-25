import { storage } from '@/lib/storage';
import { captureInstallReferrer, inviteFromReferrer } from '../installReferrer';
import { useInviteStore } from '../links';

const token = 'AbC-123_xyzQWERTYuiop';
const mod = (referrer: string | null) => ({
  getReferrer: jest.fn().mockResolvedValue(referrer),
});

describe('inviteFromReferrer', () => {
  it('reads the token, encoded or not', () => {
    expect(inviteFromReferrer(`invite=${token}`)).toBe(token);
    expect(inviteFromReferrer(`invite%3D${token}`)).toBe(token);
    expect(inviteFromReferrer(`utm_source=x&invite=${token}&b=1`)).toBe(token);
  });

  it('ignores anything else', () => {
    expect(inviteFromReferrer(null)).toBeNull();
    expect(
      inviteFromReferrer('utm_source=google-play&utm_medium=organic'),
    ).toBeNull();
    expect(inviteFromReferrer('invite=short')).toBeNull();
    expect(inviteFromReferrer(`xinvite=${token}`)).toBeNull();
    expect(inviteFromReferrer('%E0%A4%A')).toBeNull();
  });
});

describe('captureInstallReferrer', () => {
  beforeEach(() => {
    storage.remove('invite.installReferrerChecked');
    useInviteStore.getState().setPendingToken(null);
  });

  it('keeps the invite once, on Android only', async () => {
    const m = mod(`invite=${token}`);
    await captureInstallReferrer('ios', m);
    expect(m.getReferrer).not.toHaveBeenCalled();

    await captureInstallReferrer('android', m);
    expect(useInviteStore.getState().pendingToken).toBe(token);

    useInviteStore.getState().setPendingToken(null);
    await captureInstallReferrer('android', m);
    expect(m.getReferrer).toHaveBeenCalledTimes(1);
    expect(useInviteStore.getState().pendingToken).toBeNull();
  });

  it('does not replace a link opened just now', async () => {
    useInviteStore.getState().setPendingToken('Opened-link-token-123');
    await captureInstallReferrer('android', mod(`invite=${token}`));
    expect(useInviteStore.getState().pendingToken).toBe(
      'Opened-link-token-123',
    );
  });

  it('copes with no module or a failing one', async () => {
    await captureInstallReferrer('android', undefined);
    await captureInstallReferrer('android', {
      getReferrer: jest.fn().mockRejectedValue(new Error('no play')),
    });
    expect(useInviteStore.getState().pendingToken).toBeNull();
  });
});
