import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, User } from 'lucide-react-native';
import {
  Banner,
  Button,
  FormTextField,
  Screen,
  Stack,
  Text,
  toast,
} from '@/components';
import { toAppError } from '@/features/auth/errors';
import { emailSchema, nameSchema } from '@/features/auth/schemas';
import { useAddFriend } from '../api';

const schema = z.object({
  email: emailSchema,
  name: z.string().trim().max(100, 'Name is too long'),
});
type Values = z.infer<typeof schema>;

export function AddFriendScreen() {
  const navigation = useNavigation();
  const addFriend = useAddFriend();
  // Set when the email isn't on Sharelith yet: we need a name to invite them.
  const [needsName, setNeedsName] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '' },
  });

  const onSubmit = handleSubmit(async ({ email, name }) => {
    setFormError(null);
    if (needsName) {
      const parsed = nameSchema.safeParse(name);
      if (!parsed.success) {
        setError('name', { message: 'Enter their name' });
        return;
      }
    }
    try {
      const result = await addFriend.mutateAsync({
        email,
        name: needsName ? name.trim() : undefined,
      });
      if (result.status === 'needs_name') {
        setNeedsName(true);
        return;
      }
      const first = result.friend.full_name.split(' ')[0];
      toast.show(
        result.status === 'invited'
          ? `Invited ${first} — they’ll get an email`
          : result.status === 'already_friends'
          ? `${first} is already your friend`
          : `Added ${first}`,
        'success',
      );
      navigation.goBack();
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  });

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        <Text color="textSecondary">
          {needsName
            ? 'They’re not on Sharelith yet. Add their name and we’ll email them an invite — you can split expenses with them right away.'
            : 'Enter your friend’s email. If they’re on Sharelith they’re added straight away; if not, we’ll invite them.'}
        </Text>
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <FormTextField
          control={control}
          name="email"
          label="Email address"
          leadingIcon={Mail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!needsName}
          testID="add-friend-email"
        />
        {needsName ? (
          <FormTextField
            control={control}
            name="name"
            label="Their name"
            leadingIcon={User}
            autoComplete="name"
            autoFocus
            testID="add-friend-name"
          />
        ) : null}
        <Button
          title={needsName ? 'Send invite' : 'Add friend'}
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSubmit}
          testID="add-friend-submit"
        />
      </Stack>
    </Screen>
  );
}
