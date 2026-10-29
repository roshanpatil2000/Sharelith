import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { launchImageLibrary } from 'react-native-image-picker';
import { Camera, Mail, Phone, User } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  Avatar,
  Banner,
  Button,
  FormTextField,
  Icon,
  Pressable,
  Screen,
  Stack,
  TextField,
  toast,
} from '@/components';
import { toAppError } from '@/features/auth/errors';
import { nameSchema, phoneSchema } from '@/features/auth/schemas';
import { useProfile, useUpdateProfile, useUploadAvatar } from '../api';

const editProfileSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
});
type EditProfileValues = z.infer<typeof editProfileSchema>;

export function EditProfileScreen() {
  const styles = useStyles(createStyles);
  const navigation = useNavigation();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset, formState } =
    useForm<EditProfileValues>({
      resolver: zodResolver(editProfileSchema),
      defaultValues: { fullName: '', phone: '' },
    });

  useEffect(() => {
    if (profile) {
      reset({ fullName: profile.full_name, phone: profile.phone ?? '' });
    }
  }, [profile, reset]);

  const pickAvatar = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.8,
      includeBase64: true,
      selectionLimit: 1,
    });
    const asset = result.assets?.[0];
    if (result.didCancel || !asset?.base64) {
      return;
    }
    uploadAvatar.mutate(
      { base64: asset.base64, type: asset.type },
      {
        onSuccess: () => toast.show('Photo updated', 'success'),
        onError: e => toast.show(toAppError(e).message, 'error'),
      },
    );
  };

  const onSubmit = handleSubmit(async ({ fullName, phone }) => {
    setFormError(null);
    try {
      await updateProfile.mutateAsync({
        full_name: fullName,
        phone: phone || null,
      });
      toast.show('Profile saved', 'success');
      navigation.goBack();
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  });

  if (!profile) {
    return <Screen>{null}</Screen>;
  }

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        <View style={styles.avatarWrap}>
          <Pressable
            onPress={pickAvatar}
            disabled={uploadAvatar.isPending}
            accessibilityLabel="Change profile photo"
            testID="edit-avatar"
          >
            <Avatar
              name={profile.full_name}
              uri={profile.avatar_url}
              size="xl"
            />
            <View style={styles.cameraBadge}>
              <Icon icon={Camera} size={16} color="textOnPrimary" />
            </View>
          </Pressable>
        </View>
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <FormTextField
          control={control}
          name="fullName"
          label="Full name"
          leadingIcon={User}
          autoComplete="name"
          testID="edit-name"
        />
        <TextField
          label="Email address"
          leadingIcon={Mail}
          value={profile.email ?? ''}
          editable={false}
          helper="Changing your email is coming soon."
        />
        <FormTextField
          control={control}
          name="phone"
          label="Phone number (optional)"
          leadingIcon={Phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          testID="edit-phone"
        />
        <Button
          title="Save"
          size="lg"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSubmit}
          testID="edit-save"
        />
      </Stack>
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    avatarWrap: { alignItems: 'center', paddingVertical: t.spacing.md },
    cameraBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 30,
      height: 30,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.primary,
      borderWidth: 2,
      borderColor: t.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
