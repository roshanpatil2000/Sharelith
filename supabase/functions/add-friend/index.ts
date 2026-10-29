// Adds a friend by email (instant, like Splitwise). Unknown emails get a
// Supabase invite: the auth user + profile exist right away (marked invited),
// so they can be used in expenses before they accept.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  DAILY_FRIEND_LIMIT,
  buildFriendAddedEmail,
  normalizeEmail,
  normalizeName,
  orderedPair,
} from '../_shared/friends.ts';
import { sendEmail } from '../_shared/mailtrap.ts';

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

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return fail(405, 'method_not_allowed', 'Method not allowed');
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
  });
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

  // Service role: look up users by email and write friendships.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', me.id)
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_FRIEND_LIMIT) {
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

  const { data: existing } = await admin
    .from('profiles')
    .select('id, full_name, email, joined_at')
    .ilike('email', email)
    .maybeSingle();

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
    const redirect =
      (Deno.env.get('AUTH_REDIRECT_URL') ??
        'https://sharelith.techbeas.co.in/auth/callback') + '?next=invite';
    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name, invited_by: me.id, invited_by_name: myName },
      redirectTo: redirect,
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
});
