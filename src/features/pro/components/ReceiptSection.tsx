import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Camera, Crown, X } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  Button,
  IconButton,
  Row,
  SectionHeader,
  Skeleton,
  Stack,
  Text,
  toast,
} from '@/components';
import { toAppError } from '@/features/auth/errors';
import { useIsPro } from '../pro';
import { useProGate } from '../useProGate';
import { useReceiptUrl, useSetReceipt } from '../receipts';

/** The receipt photo on an expense: everyone on it can view; Pro can add or change it. */
export function ReceiptSection({
  expenseId,
  path,
}: {
  expenseId: string;
  path: string | null | undefined;
}) {
  const styles = useStyles(createStyles);
  const isPro = useIsPro();
  const gate = useProGate();
  const url = useReceiptUrl(path);
  const setReceipt = useSetReceipt(expenseId);
  const [open, setOpen] = useState(false);

  const pick = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.7,
      includeBase64: true,
      selectionLimit: 1,
    });
    const asset = result.assets?.[0];
    if (result.didCancel || !asset?.base64) {
      return;
    }
    setReceipt.mutate(
      { image: { base64: asset.base64, type: asset.type }, previous: path },
      {
        onSuccess: () => toast.show('Receipt added', 'success'),
        onError: e => toast.show(toAppError(e).message, 'error'),
      },
    );
  };

  const remove = () =>
    setReceipt.mutate(
      { image: null, previous: path },
      { onError: e => toast.show(toAppError(e).message, 'error') },
    );

  return (
    <>
      <SectionHeader title="Receipt" />
      <Stack gap="sm" px="lg" py="sm">
        {path ? (
          url.data ? (
            <Pressable
              onPress={() => setOpen(true)}
              accessibilityLabel="View receipt"
              testID="receipt-thumb"
            >
              <Image
                source={{ uri: url.data }}
                style={styles.thumb}
                resizeMode="cover"
              />
            </Pressable>
          ) : (
            <Skeleton height={160} />
          )
        ) : (
          <Text color="textSecondary">No receipt photo yet.</Text>
        )}
        <Row gap="sm">
          <Button
            title={path ? 'Replace photo' : 'Add receipt photo'}
            icon={isPro ? Camera : Crown}
            variant="secondary"
            loading={setReceipt.isPending}
            onPress={gate(pick)}
            testID="receipt-add"
          />
          {path && isPro ? (
            <Button
              title="Remove"
              variant="ghost"
              onPress={remove}
              disabled={setReceipt.isPending}
              testID="receipt-remove"
            />
          ) : null}
        </Row>
        {isPro ? null : (
          <Text variant="caption" color="textSecondary">
            Receipt photos are part of Sharelith Pro.
          </Text>
        )}
      </Stack>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.viewer}>
          {url.data ? (
            <Image
              source={{ uri: url.data }}
              style={styles.full}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.close}>
            <IconButton
              icon={X}
              accessibilityLabel="Close"
              onPress={() => setOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    thumb: {
      width: '100%',
      height: 200,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.surface,
    },
    viewer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
    },
    full: { width: '100%', height: '85%' },
    close: { position: 'absolute', top: 48, right: 16 },
  });
