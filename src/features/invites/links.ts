import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

/** The website that forwards invite links into the app. */
export const INVITE_HOST = 'https://sharelith.techbeas.co.in';

/** The link people share: opens the app if installed, the website if not. */
export const inviteUrl = (token: string) => `${INVITE_HOST}/invite/${token}`;

const pattern =
  /^(?:sharelith:\/\/invite|https:\/\/sharelith\.techbeas\.co\.in\/invite)\/([A-Za-z0-9_-]{16,64})\/?(?:[?#].*)?$/;

/** The token in an invite link, or null for any other URL. */
export function parseInviteLink(url: string): string | null {
  return url.match(pattern)?.[1] ?? null;
}

type InviteState = {
  /** An opened invite waiting to be used, kept through sign-up and sign-in. */
  pendingToken: string | null;
  setPendingToken: (token: string | null) => void;
};

export const useInviteStore = create<InviteState>()(
  persist(
    set => ({
      pendingToken: null,
      setPendingToken: pendingToken => set({ pendingToken }),
    }),
    {
      name: 'invite.pending',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

/** Remembers an opened invite link; returns whether the URL was one. */
export function captureInviteLink(url: string): boolean {
  const token = parseInviteLink(url);
  if (token) {
    useInviteStore.getState().setPendingToken(token);
  }
  return !!token;
}
