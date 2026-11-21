import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Send } from 'lucide-react-native';
import {
  Avatar,
  Box,
  IconButton,
  ListRow,
  Row,
  SectionHeader,
  Text,
  TextField,
  toast,
} from '@/components';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import { friendlyDate, toISODate } from '@/domain/dates';
import {
  MAX_COMMENT,
  useAddComment,
  useDeleteComment,
  useExpenseComments,
  type ExpenseComment,
} from '../comments';

const when = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${friendlyDate(toISODate(d))}, ${time}`;
};

/** Comments under an expense, with a box to add one. */
export function CommentsSection({ expenseId }: { expenseId: string }) {
  const me = useUserId();
  const { data: comments } = useExpenseComments(expenseId);
  const add = useAddComment(expenseId);
  const remove = useDeleteComment(expenseId);
  const [draft, setDraft] = useState('');

  const send = async () => {
    if (!draft.trim()) {
      return;
    }
    try {
      await add.mutateAsync(draft);
      setDraft('');
    } catch (e) {
      toast.show(toAppError(e).message, 'error');
    }
  };

  const confirmDelete = (c: ExpenseComment) =>
    Alert.alert('Delete comment?', c.body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove
            .mutateAsync(c.id)
            .catch(e => toast.show(toAppError(e).message, 'error')),
      },
    ]);

  return (
    <>
      <SectionHeader
        title={`Comments${comments?.length ? ` (${comments.length})` : ''}`}
      />
      {comments?.map(c => {
        const name =
          c.author_id === me ? 'You' : c.author?.full_name ?? 'Someone';
        return (
          <ListRow
            key={c.id}
            title={c.body}
            subtitle={`${name} · ${when(c.created_at)}`}
            leading={<Avatar name={c.author?.full_name ?? '?'} size="sm" />}
            onPress={c.author_id === me ? () => confirmDelete(c) : undefined}
            testID={`comment-${c.id}`}
          />
        );
      })}
      {comments && comments.length === 0 ? (
        <Box px="lg" py="sm">
          <Text color="textSecondary">No comments yet.</Text>
        </Box>
      ) : null}
      <Row px="lg" py="sm" gap="sm">
        <Box flex={1}>
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment"
            maxLength={MAX_COMMENT}
            multiline
            testID="comment-input"
          />
        </Box>
        <IconButton
          icon={Send}
          color="primary"
          accessibilityLabel="Send comment"
          disabled={!draft.trim() || add.isPending}
          onPress={send}
          testID="comment-send"
        />
      </Row>
    </>
  );
}
