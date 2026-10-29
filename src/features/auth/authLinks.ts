import { Linking } from 'react-native';
import { toast } from '@/components';
import { env } from '@/lib/env';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { profileKey, type Profile } from '@/features/account/api';
import { useAuthStore } from './authStore';
import { toAppError } from './errors';

/** What an emailed link should do once it reaches the app. */
export type AuthLinkIntent = 'verify' | 'reset';

/** Redirect target for emails; the bridge page forwards it to sharelith://. */
export function authRedirectFor(intent: AuthLinkIntent): string {
  return `${env.authRedirectUrl}?next=${intent}`;
}

export type ParsedAuthLink =
  | { kind: 'code'; code: string; intent: AuthLinkIntent | null }
  | { kind: 'error'; code: string | null; description: string | null };

/**
 * Parses sharelith://auth/callback?code=…&next=… (and Supabase's error
 * parameters, which may arrive in the query or the fragment).
 * Returns null for any other URL.
 */
export function parseAuthLink(url: string): ParsedAuthLink | null {
  const match = url.match(/^sharelith:\/\/auth\/callback\/?(\?[^#]*)?(#.*)?$/);
  if (!match) {
    return null;
  }
  const params = new URLSearchParams(match[1]?.slice(1) ?? '');
  new URLSearchParams(match[2]?.slice(1) ?? '').forEach((v, k) => {
    if (!params.has(k)) {
      params.set(k, v);
    }
  });

  const error = params.get('error') ?? params.get('error_code');
  if (error) {
    return {
      kind: 'error',
      code: params.get('error_code') ?? error,
      description: params.get('error_description'),
    };
  }
  const code = params.get('code');
  if (!code) {
    return null;
  }
  const next = params.get('next');
  return {
    kind: 'code',
    code,
    intent: next === 'verify' || next === 'reset' ? next : null,
  };
}

/** Signs in with the link's code, then finishes verification or reset. */
export async function handleAuthLink(url: string): Promise<void> {
  const link = parseAuthLink(url);
  if (!link) {
    return;
  }
  if (link.kind === 'error') {
    toast.show(
      link.code === 'otp_expired'
        ? 'That link has expired. Request a new one.'
        : link.description ?? 'That link didn’t work. Request a new one.',
      'error',
    );
    return;
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(link.code);
  if (error) {
    // Usually the link was opened on a different device than it was
    // requested from (PKCE), or it was already used.
    toast.show(
      'Open the link on the phone where you requested it, or use the code from the email.',
      'error',
    );
    return;
  }

  const userId = data.user?.id;
  if (link.intent === 'reset') {
    useAuthStore.getState().setPasswordResetPending(true);
    // Opening a reset email also proves the address; best effort.
    const marked = await supabase.rpc('mark_email_verified');
    if (!marked.error && userId) {
      await markProfileVerified(userId);
    }
    return;
  }
  if (link.intent === 'verify') {
    const marked = await supabase.rpc('mark_email_verified');
    if (marked.error) {
      toast.show(toAppError(marked.error).message, 'error');
      return;
    }
    if (userId) {
      await markProfileVerified(userId);
    }
    toast.show('Email confirmed', 'success');
  }
}

/**
 * Signing in from the link starts a profile fetch that can race the
 * mark_email_verified call and cache the old value. Update the cache
 * directly, then refetch so it matches the server.
 */
export async function markProfileVerified(userId: string): Promise<void> {
  const key = profileKey(userId);
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<Profile>(key, old =>
    old && !old.email_verified_at
      ? { ...old, email_verified_at: new Date().toISOString() }
      : old,
  );
  await queryClient.refetchQueries({ queryKey: key, type: 'all' });
}

/** Handles the link that launched the app and any opened while running. */
export function startAuthLinkListener(): () => void {
  Linking.getInitialURL()
    .then(url => (url ? handleAuthLink(url) : undefined))
    .catch(() => {});
  const sub = Linking.addEventListener('url', ({ url }) => {
    handleAuthLink(url);
  });
  return () => sub.remove();
}
