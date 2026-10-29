import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut, Trash2, UserMinus, UserPlus } from 'lucide-react-native';
import {
  Avatar,
  Badge,
  Banner,
  Box,
  Button,
  ConfirmDialog,
  Divider,
  Icon,
  IconButton,
  ListRow,
  Row,
  Screen,
  SectionHeader,
  Switch,
  toast,
} from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import {
  useDeleteGroup,
  useGroup,
  useIsGroupAdmin,
  useLeaveGroup,
  useRemoveGroupMember,
  useUpdateGroup,
  useUploadGroupCover,
  type GroupMember,
} from '../api';
import { asGroupType, type GroupType } from '../groupTypes';
import {
  GroupDetailsFields,
  groupDetailsSchema,
  pickCoverImage,
  type GroupDetailsValues,
} from '../components/GroupDetailsFields';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupSettings'>;

type Confirm =
  | { kind: 'leave' }
  | { kind: 'delete' }
  | { kind: 'remove'; member: GroupMember };

const firstName = (name: string) => name.split(' ')[0];

export function GroupSettingsScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const userId = useUserId();
  const { data: group } = useGroup(groupId);
  const isAdmin = useIsGroupAdmin(group ?? undefined);
  const updateGroup = useUpdateGroup(groupId);
  const uploadCover = useUploadGroupCover(groupId);
  const removeMember = useRemoveGroupMember(groupId);
  const leaveGroup = useLeaveGroup(groupId);
  const deleteGroup = useDeleteGroup(groupId);
  const [type, setType] = useState<GroupType>('other');
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset, formState } =
    useForm<GroupDetailsValues>({
      resolver: zodResolver(groupDetailsSchema),
      defaultValues: { name: '', description: '' },
    });

  // Load the form once; later refetches shouldn't wipe what's being typed.
  const loaded = !!group;
  useEffect(() => {
    if (group) {
      reset({ name: group.name, description: group.description ?? '' });
      setType(asGroupType(group.type));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, reset]);

  if (!group) {
    return <Screen>{null}</Screen>;
  }

  const onSave = handleSubmit(async ({ name, description }) => {
    setFormError(null);
    try {
      await updateGroup.mutateAsync({
        name,
        description: description || null,
        type,
      });
      toast.show('Group saved', 'success');
      navigation.goBack();
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  });

  const pickCover = async () => {
    const image = await pickCoverImage();
    if (image) {
      uploadCover.mutate(image, {
        onSuccess: () => toast.show('Cover updated', 'success'),
        onError: e => toast.show(toAppError(e).message, 'error'),
      });
    }
  };

  const toggleSimplify = (value: boolean) =>
    updateGroup.mutate(
      { simplify_debts: value },
      { onError: e => toast.show(toAppError(e).message, 'error') },
    );

  const onConfirm = () => {
    if (!confirm) {
      return;
    }
    const onError = (e: unknown) => {
      setConfirm(null);
      toast.show(toAppError(e).message, 'error');
    };
    if (confirm.kind === 'remove') {
      removeMember.mutate(confirm.member.id, {
        onSuccess: () => {
          setConfirm(null);
          toast.show(`Removed ${firstName(confirm.member.full_name)}`);
        },
        onError,
      });
    } else {
      const mutation = confirm.kind === 'leave' ? leaveGroup : deleteGroup;
      mutation.mutate(undefined, {
        onSuccess: () => {
          toast.show(
            confirm.kind === 'leave'
              ? `You left ${group.name}`
              : `Deleted ${group.name}`,
          );
          navigation.popToTop();
        },
        onError,
      });
    }
  };

  const dialog =
    confirm?.kind === 'remove'
      ? {
          title: `Remove ${firstName(confirm.member.full_name)}?`,
          message:
            'They’ll no longer see this group. You can add them again later.',
          label: 'Remove',
        }
      : confirm?.kind === 'delete'
      ? {
          title: `Delete ${group.name}?`,
          message: 'This deletes the group for everyone. It can’t be undone.',
          label: 'Delete',
        }
      : {
          title: `Leave ${group.name}?`,
          message: isAdmin
            ? 'You’re the admin: the longest-standing member takes over. You can be added back later.'
            : 'You can be added back later by the admin.',
          label: 'Leave',
        };

  return (
    <Screen scroll edges={['bottom', 'left', 'right']}>
      <Box p="lg" gap="lg">
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <GroupDetailsFields
          control={control}
          type={type}
          onTypeChange={setType}
          coverUri={group.cover_url}
          onPickCover={pickCover}
          coverBusy={uploadCover.isPending}
        />
        <Button
          title="Save changes"
          fullWidth
          loading={formState.isSubmitting}
          onPress={onSave}
          testID="group-save"
        />
      </Box>

      <SectionHeader title={`Members (${group.members.length})`} />
      {isAdmin ? (
        <ListRow
          title="Add people"
          leading={<Icon icon={UserPlus} color="primary" />}
          onPress={() => navigation.navigate('AddGroupMembers', { groupId })}
          testID="group-add-people"
        />
      ) : null}
      {group.members.map(m => {
        const isMe = m.id === userId;
        const memberIsAdmin = m.id === group.created_by;
        return (
          <ListRow
            key={m.id}
            testID={`group-member-${m.id}`}
            title={isMe ? `${m.full_name} (you)` : m.full_name}
            subtitle={
              m.invited ? 'Invited · hasn’t joined yet' : m.email ?? undefined
            }
            leading={<Avatar name={m.full_name} uri={m.avatar_url} size="sm" />}
            trailing={
              <Row gap="sm" align="center">
                {memberIsAdmin ? <Badge label="Admin" tone="neutral" /> : null}
                {isAdmin && !isMe ? (
                  <IconButton
                    icon={UserMinus}
                    color="danger"
                    accessibilityLabel={`Remove ${m.full_name}`}
                    onPress={() => setConfirm({ kind: 'remove', member: m })}
                    testID={`group-remove-${m.id}`}
                  />
                ) : null}
              </Row>
            }
            onPress={
              isMe
                ? undefined
                : () => navigation.navigate('FriendDetail', { friendId: m.id })
            }
          />
        );
      })}

      <SectionHeader title="Settings" />
      <ListRow
        title="Simplify group debts"
        subtitle="Combine debts to reduce the number of repayments."
        trailing={
          <Switch
            value={group.simplify_debts}
            onValueChange={toggleSimplify}
            accessibilityLabel="Simplify group debts"
            testID="group-simplify"
          />
        }
      />
      <Divider />
      <ListRow
        title="Leave group"
        leading={<Icon icon={LogOut} color="danger" />}
        onPress={() => setConfirm({ kind: 'leave' })}
        testID="group-leave"
      />
      {isAdmin ? (
        <ListRow
          title="Delete group"
          leading={<Icon icon={Trash2} color="danger" />}
          onPress={() => setConfirm({ kind: 'delete' })}
          testID="group-delete"
        />
      ) : null}

      <ConfirmDialog
        visible={!!confirm}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.label}
        destructive
        loading={
          removeMember.isPending ||
          leaveGroup.isPending ||
          deleteGroup.isPending
        }
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}
