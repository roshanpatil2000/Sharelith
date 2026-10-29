import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Control } from 'react-hook-form';
import { z } from 'zod';
import { launchImageLibrary } from 'react-native-image-picker';
import { Camera, Users } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  Chip,
  ChipGroup,
  FormTextField,
  Icon,
  Pressable,
  Stack,
  Text,
} from '@/components';
import type { PickedImage } from '@/features/account/api';
import {
  GROUP_TYPES,
  groupTypeIcon,
  groupTypeLabel,
  type GroupType,
} from '../groupTypes';
import { GroupCover } from './GroupCover';

export const groupDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give your group a name')
    .max(100, 'Name is too long'),
  description: z.string().trim().max(500, 'Description is too long'),
});
export type GroupDetailsValues = z.infer<typeof groupDetailsSchema>;

/** Opens the photo library; null if cancelled. */
export async function pickCoverImage(): Promise<
  (PickedImage & { uri?: string }) | null
> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.8,
    includeBase64: true,
    selectionLimit: 1,
  });
  const asset = result.assets?.[0];
  if (result.didCancel || !asset?.base64) {
    return null;
  }
  return { base64: asset.base64, type: asset.type, uri: asset.uri };
}

type Props = {
  control: Control<GroupDetailsValues>;
  type: GroupType;
  onTypeChange: (type: GroupType) => void;
  coverUri?: string | null;
  onPickCover: () => void;
  coverBusy?: boolean;
};

/** Cover, name, type and description: shared by Create group and Settings. */
export function GroupDetailsFields({
  control,
  type,
  onTypeChange,
  coverUri,
  onPickCover,
  coverBusy,
}: Props) {
  const styles = useStyles(createStyles);
  return (
    <Stack gap="lg">
      <View style={styles.coverWrap}>
        <Pressable
          onPress={onPickCover}
          disabled={coverBusy}
          accessibilityRole="button"
          accessibilityLabel={
            coverUri ? 'Change cover photo' : 'Add cover photo'
          }
          testID="group-cover"
        >
          <GroupCover type={type} uri={coverUri} size="xl" />
          <View style={styles.cameraBadge}>
            <Icon icon={Camera} size={16} color="textOnPrimary" />
          </View>
        </Pressable>
      </View>
      <FormTextField
        control={control}
        name="name"
        label="Group name"
        leadingIcon={Users}
        maxLength={100}
        testID="group-name"
      />
      <Stack gap="sm">
        <Text variant="label" color="textSecondary">
          Type
        </Text>
        <ChipGroup>
          {GROUP_TYPES.map(t => (
            <Chip
              key={t}
              label={groupTypeLabel(t)}
              leading={
                <Icon icon={groupTypeIcon(t)} size={16} color="primary" />
              }
              selected={type === t}
              onPress={() => onTypeChange(t)}
              testID={`group-type-${t}`}
            />
          ))}
        </ChipGroup>
      </Stack>
      <FormTextField
        control={control}
        name="description"
        label="Description (optional)"
        multiline
        maxLength={500}
        testID="group-description"
      />
    </Stack>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    coverWrap: { alignItems: 'center', paddingTop: t.spacing.sm },
    cameraBadge: {
      position: 'absolute',
      right: -6,
      bottom: -6,
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
