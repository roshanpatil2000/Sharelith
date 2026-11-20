import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/app/theme';
import {
  BarChart3,
  Camera,
  Crown,
  FileDown,
  Sparkles,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Icon,
  Pressable,
  Row,
  Screen,
  Stack,
  Text,
  toast,
} from '@/components';
import { useRemoteConfig } from '@/lib/remoteConfig';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import { useProStatus } from '../pro';
import {
  billingSupported,
  listenForPurchases,
  loadPlans,
  manageSubscription,
  restorePurchases,
  subscribe,
  type ProPlan,
} from '../billing';

const benefits: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Sparkles,
    title: 'No ads',
    body: 'No full-screen or in-list ads, anywhere.',
  },
  {
    icon: Camera,
    title: 'Receipt photos',
    body: 'Attach a photo of the bill to any expense.',
  },
  {
    icon: FileDown,
    title: 'Export',
    body: 'Export a group or friend as CSV or PDF.',
  },
  {
    icon: BarChart3,
    title: 'Insights',
    body: 'Spending by category and month, with charts.',
  },
];

function formatDate(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';
}

export function ProScreen() {
  const theme = useTheme();
  const userId = useUserId();
  const { data: status, refetch } = useProStatus();
  const monthlySku = useRemoteConfig(s => s.pro_monthly_sku);
  const yearlySku = useRemoteConfig(s => s.pro_yearly_sku);
  const plans = useQuery({
    queryKey: ['pro-plans', monthlySku, yearlySku],
    enabled: billingSupported,
    queryFn: () => loadPlans([yearlySku, monthlySku]),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(
    () =>
      listenForPurchases({
        onVerified: isPro => {
          setBusy(null);
          refetch();
          toast.show(
            isPro
              ? 'Welcome to Sharelith Pro!'
              : 'Purchase received; Pro will turn on shortly.',
          );
        },
        onError: message => {
          setBusy(null);
          toast.show(message, 'error');
        },
      }),
    [refetch],
  );

  const available = plans.data ?? [];
  const plan: ProPlan | undefined =
    available.find(p => p.sku === selected) ?? available[0];

  const buy = async () => {
    if (!plan || !userId) {
      return;
    }
    setBusy('buy');
    try {
      await subscribe(plan, userId);
    } catch (e) {
      setBusy(null);
      toast.show(toAppError(e).message, 'error');
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const isPro = await restorePurchases();
      toast.show(
        isPro
          ? 'Sharelith Pro restored.'
          : 'No active subscription found on this Google account.',
      );
    } catch (e) {
      toast.show(toAppError(e).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll padded>
      <Stack gap="lg" py="lg">
        <Stack align="center" gap="sm">
          <Icon icon={Crown} color="primary" size={48} />
          <Text variant="display" align="center">
            Sharelith Pro
          </Text>
          {status?.isPro ? (
            <Text color="textSecondary" align="center" testID="pro-active">
              {status.expiresAt
                ? `${
                    status.status === 'canceled' ? 'Ends' : 'Renews'
                  } on ${formatDate(status.expiresAt)}`
                : 'Pro is on for your account.'}
            </Text>
          ) : null}
        </Stack>

        <Card>
          <Stack gap="md" p="lg">
            {benefits.map(b => (
              <Row key={b.title} gap="md" align="flex-start">
                <Icon icon={b.icon} color="primary" />
                <Stack flex={1} gap="xxs">
                  <Text variant="bodyStrong">{b.title}</Text>
                  <Text color="textSecondary">{b.body}</Text>
                </Stack>
              </Row>
            ))}
          </Stack>
        </Card>

        {status?.isPro ? (
          status.productId ? (
            <Button
              title="Manage subscription"
              variant="secondary"
              onPress={() =>
                manageSubscription(status.productId).catch(() => {})
              }
              testID="pro-manage"
            />
          ) : null
        ) : !billingSupported ? (
          <Text color="textSecondary" align="center" testID="pro-unsupported">
            Pro is coming to iPhone soon.
          </Text>
        ) : (
          <Stack gap="md">
            {plans.isLoading ? (
              <Text color="textSecondary" align="center">
                Loading plans…
              </Text>
            ) : available.length === 0 ? (
              <Text color="textSecondary" align="center" testID="pro-no-plans">
                Plans aren’t available right now. Install Sharelith from Google
                Play to subscribe.
              </Text>
            ) : (
              available.map(p => {
                const yearly = p.sku === yearlySku;
                const active = p.sku === plan?.sku;
                return (
                  <Pressable
                    key={p.sku}
                    onPress={() => setSelected(p.sku)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    testID={`pro-plan-${p.sku}`}
                  >
                    <View
                      style={[
                        styles.plan,
                        {
                          padding: theme.spacing.lg,
                          borderRadius: theme.radius.lg,
                          backgroundColor: theme.colors.surface,
                          borderColor: active
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                      ]}
                    >
                      <Row justify="space-between">
                        <Text variant="bodyStrong">
                          {yearly ? 'Yearly' : 'Monthly'}
                        </Text>
                        <Text variant="bodyStrong">
                          {p.price}
                          {yearly ? ' / year' : ' / month'}
                        </Text>
                      </Row>
                    </View>
                  </Pressable>
                );
              })
            )}
            <Button
              title="Subscribe"
              size="lg"
              fullWidth
              disabled={!plan || busy !== null}
              loading={busy === 'buy'}
              onPress={buy}
              testID="pro-subscribe"
            />
            <Button
              title="Restore purchases"
              variant="ghost"
              disabled={busy !== null}
              loading={busy === 'restore'}
              onPress={restore}
              testID="pro-restore"
            />
            <Text variant="caption" color="textSecondary" align="center">
              Renews automatically until cancelled in Google Play. Cancel any
              time.
            </Text>
          </Stack>
        )}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plan: { borderWidth: 2 },
});
