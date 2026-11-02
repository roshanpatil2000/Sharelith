// The add-friend request handler. Clients and email are passed in (no Deno
// APIs), so Jest can test it.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  DAILY_ATTEMPT_LIMIT,
  buildFriendAddedEmail,
  normalizeEmail,
  normalizeName,
  orderedPair,
} from './friends.ts';
import type { EmailMessage } from './mailtrap.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fail = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status);

type FriendOut = {
  id: string;
  full_name: string;
  email: string | null;
  invited: boolean;
};

export type AddFriendDeps = {
  /** Acts as the caller: only used to identify them. */
  caller: SupabaseClient;
  /** Service role: looks up users by email and writes friendships. */
  admin: SupabaseClient;
  inviteRedirectUrl: string;
  sendEmail: (message: EmailMessage) => Promise<unknown>;
};

export async function handleAddFriend(
  req: Request,
  { caller, admin, inviteRedirectUrl, sendEmail }: AddFriendDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return fail(405, 'method_not_allowed', 'Method not allowed');
  }

  const { data: auth } = await caller.auth.getUser();
  const me = auth.user;
  if (!me) {
    return fail(401, 'not_signed_in', 'Not signed in');
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  if (!email) {
    return fail(400, 'invalid_email', 'Enter a valid email address');
  }
  if (email === me.email?.toLowerCase()) {
    return fail(400, 'self', 'You can’t add yourself as a friend');
  }

  // Every lookup counts, even one that adds nobody: otherwise the response
  // could be used to test which emails have accounts.
  const { data: allowed, error: limitError } = await admin.rpc(
    'claim_friend_add_attempt',
    { uid: me.id, daily_limit: DAILY_ATTEMPT_LIMIT },
  );
  if (limitError) {
    console.error('rate limit check failed', limitError);
    return fail(503, 'server', 'Couldn’t add friend. Try again.');
  }
  if (!allowed) {
    return fail(
      429,
      'rate_limited',
      'You’ve added a lot of friends today. Try again tomorrow.',
    );
  }

  const { data: myProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', me.id)
    .single();
  const myName = myProfile?.full_name ?? 'A friend';

  // Exact match: a pattern operator here would treat % and _ as wildcards.
  const { data: existing, error: lookupError } = await admin
    .from('profiles')
    .select('id, full_name, email, joined_at')
    .eq('email', email)
    .maybeSingle();
  if (lookupError) {
    console.error('profile lookup failed', lookupError);
    return fail(503, 'server', 'Couldn’t add friend. Try again.');
  }

  let friend: FriendOut;
  let status: 'added' | 'invited' | 'already_friends';

  if (existing) {
    friend = {
      id: existing.id,
      full_name: existing.full_name,
      email: existing.email,
      invited: existing.joined_at === null,
    };
    status = 'added';
  } else {
    const name = normalizeName(body?.name);
    if (!name) {
      // Ask the app for a name before sending an invite.
      return json({ status: 'needs_name' });
    }
    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name, invited_by: me.id, invited_by_name: myName },
      redirectTo: inviteRedirectUrl,
    });
    if (invited.error || !invited.data.user) {
      console.error('invite failed', invited.error);
      return fail(502, 'invite_failed', 'Couldn’t send the invite. Try again.');
    }
    friend = {
      id: invited.data.user.id,
      full_name: name,
      email,
      invited: true,
    };
    status = 'invited';
  }

  const [user_a, user_b] = orderedPair(me.id, friend.id);
  const { error: insertError } = await admin
    .from('friendships')
    .insert({ user_a, user_b, created_by: me.id });
  if (insertError) {
    if (insertError.code === '23505') {
      return json({ status: 'already_friends', friend });
    }
    console.error('friendship insert failed', insertError);
    return fail(500, 'server', 'Couldn’t add friend. Try again.');
  }

  // Let existing users know (invited people already get the invite email).
  if (status === 'added' && friend.email && !friend.invited) {
    const mail = buildFriendAddedEmail(myName, friend.full_name);
    await sendEmail({
      to: [{ email: friend.email, name: friend.full_name }],
      ...mail,
    }).catch(e => console.error('friend-added email failed', e));
  }

  return json({ status, friend });
}
