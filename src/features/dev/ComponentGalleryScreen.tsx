import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Plus, Receipt, Settings, Trash2 } from 'lucide-react-native';
import {
  ThemeProvider,
  categoryKeys,
  useStyles,
  useTheme,
  type Theme,
} from '@/app/theme';
import {
  AmountInput,
  AmountText,
  Avatar,
  AvatarStack,
  Badge,
  BalanceSummary,
  Banner,
  BottomSheet,
  Button,
  Card,
  CategoryIcon,
  Checkbox,
  Chip,
  ChipGroup,
  ConfirmDialog,
  CurrencyPicker,
  Divider,
  EmptyState,
  ErrorView,
  IconButton,
  ListRow,
  ListRowSkeleton,
  Row,
  SearchBar,
  SectionHeader,
  SegmentedControl,
  SelectField,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextField,
  toast,
} from '@/components';

const people = [
  { name: 'Roshan Patil' },
  { name: 'Asha Rao' },
  { name: 'Vikram Shah' },
  { name: 'Meera Iyer' },
  { name: 'Kabir Das' },
  { name: 'Neha Joshi' },
];

const splitSegments = [
  { value: 'equal', label: '=' },
  { value: 'exact', label: '1.23' },
  { value: 'percent', label: '%' },
  { value: 'shares', label: 'Shares' },
  { value: 'adjust', label: '+/-' },
] as const;
type SplitType = (typeof splitSegments)[number]['value'];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SectionHeader title={title} />
      <Stack gap="md" p="lg">
        {children}
      </Stack>
    </>
  );
}

function Swatch({ name, color }: { name: string; color: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.swatch}>
      <View style={[styles.chip, { backgroundColor: color }]} />
      <Text variant="caption" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function Gallery() {
  const t = useTheme();
  const styles = useStyles(createStyles);
  const sheetRef = useRef<BottomSheetModal>(null);
  const [split, setSplit] = useState<SplitType>('equal');
  const [amount, setAmount] = useState(125050);
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [selected, setSelected] = useState<string[]>(['Asha Rao']);
  const [dialog, setDialog] = useState(false);
  const [currency, setCurrency] = useState('INR');

  const { category, ...flat } = t.colors;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Section title="Palette">
        <View style={styles.swatches}>
          {Object.entries(flat).map(([name, color]) => (
            <Swatch key={name} name={name} color={color} />
          ))}
        </View>
        <Text variant="label" color="textSecondary">
          Categories
        </Text>
        <View style={styles.swatches}>
          {Object.entries(category).map(([name, color]) => (
            <Swatch key={name} name={name} color={color} />
          ))}
        </View>
      </Section>

      <Section title="Typography">
        {(Object.keys(t.typography) as (keyof typeof t.typography)[]).map(v => (
          <Text key={v} variant={v}>
            {v} · ₹1,250.50
          </Text>
        ))}
      </Section>

      <Section title="Buttons">
        <Row gap="sm" wrap>
          <Button title="Primary" />
          <Button title="Secondary" variant="secondary" />
          <Button title="Ghost" variant="ghost" />
          <Button title="Delete" variant="danger" icon={Trash2} />
        </Row>
        <Row gap="sm" wrap>
          <Button title="Small" size="sm" icon={Plus} />
          <Button title="Loading" loading />
          <Button title="Disabled" disabled />
        </Row>
        <Button title="Settle up" size="lg" fullWidth />
        <Row gap="sm">
          <IconButton icon={Settings} accessibilityLabel="Settings" />
          <IconButton icon={Plus} accessibilityLabel="Add" filled />
        </Row>
      </Section>

      <Section title="Inputs">
        <TextField label="Description" placeholder="Enter a description" />
        <TextField
          label="Email"
          value="not-an-email"
          error="Enter a valid email address"
        />
        <SearchBar value={query} onChangeText={setQuery} />
        <AmountInput value={amount} currency="INR" onChange={setAmount} />
        <SegmentedControl
          segments={splitSegments}
          value={split}
          onChange={setSplit}
        />
        <Row justify="space-between">
          <Checkbox
            checked={checked}
            onChange={setChecked}
            label="Include me"
          />
          <Switch
            value={on}
            onValueChange={setOn}
            accessibilityLabel="Simplify debts"
          />
        </Row>
        <ChipGroup>
          {people.slice(0, 4).map(p => (
            <Chip
              key={p.name}
              label={p.name}
              selected={selected.includes(p.name)}
              leading={<Avatar name={p.name} size="xs" />}
              onPress={() =>
                setSelected(s =>
                  s.includes(p.name)
                    ? s.filter(n => n !== p.name)
                    : [...s, p.name],
                )
              }
            />
          ))}
        </ChipGroup>
      </Section>

      <SectionHeader title="Pickers" />
      <CurrencyPicker value={currency} onChange={setCurrency} />
      <Divider inset={52} />
      <SelectField
        label="Split by"
        value={split}
        options={splitSegments.map(s => ({ value: s.value, label: s.label }))}
        onChange={setSplit}
      />

      <Section title="Avatars & categories">
        <Row gap="sm">
          <Avatar name="Roshan Patil" size="xs" />
          <Avatar name="Asha Rao" size="sm" />
          <Avatar name="Vikram Shah" size="md" />
          <Avatar name="Meera Iyer" size="lg" />
          <Avatar name="Kabir Das" size="xl" />
        </Row>
        <AvatarStack people={people} />
        <Row gap="sm" wrap>
          {categoryKeys.map(c => (
            <CategoryIcon key={c} category={c} />
          ))}
        </Row>
      </Section>

      <Section title="Amounts & balances">
        <Row gap="lg">
          <AmountText minor={50000} currency="INR" />
          <AmountText minor={-12550} currency="INR" />
          <AmountText minor={0} currency="INR" />
        </Row>
        <BalanceSummary
          balances={[
            { currency: 'INR', minor: 245000 },
            { currency: 'USD', minor: -1800 },
          ]}
        />
        <BalanceSummary balances={[]} />
        <Row gap="sm">
          <Badge label="PRO" tone="accent" />
          <Badge label={3} tone="danger" />
          <Badge label="Settled" tone="neutral" />
        </Row>
      </Section>

      <SectionHeader title="List rows" />
      <ListRow
        title="Goa trip"
        subtitle="Asha owes you ₹1,200.00"
        leading={<Avatar name="Goa trip" />}
        trailing={
          <>
            <Text variant="caption" color="positive">
              you are owed
            </Text>
            <AmountText minor={120000} currency="INR" />
          </>
        }
        onPress={() => {}}
      />
      <Divider inset={68} />
      <ListRow
        title="Dinner at Bombay Canteen"
        subtitle="Vikram paid ₹3,400.00"
        leading={<CategoryIcon category="food" />}
        trailing={
          <>
            <Text variant="caption" color="negative">
              you borrowed
            </Text>
            <AmountText minor={-85000} currency="INR" />
          </>
        }
        onPress={() => {}}
      />
      <Divider inset={68} />
      <ListRow title="Notifications" chevron onPress={() => {}} />
      <ListRowSkeleton />

      <Section title="Cards & feedback">
        <Card>
          <Text variant="heading">Card</Text>
          <Text color="textSecondary">Flat card on raised surface.</Text>
        </Card>
        <Card elevated>
          <Text variant="heading">Elevated card</Text>
        </Card>
        <Banner
          message="You are offline. Changes will sync later."
          tone="offline"
        />
        <Banner
          message="Asha owes you ₹1,200.00"
          tone="info"
          actionLabel="Remind"
          onAction={() => toast.show('Reminder sent', 'success')}
        />
        <Banner message="Could not save expense" tone="danger" />
        <Skeleton width="60%" />
        <Row gap="sm" wrap>
          <Button
            title="Toast"
            size="sm"
            variant="secondary"
            onPress={() => toast.show('Expense saved', 'success')}
          />
          <Button
            title="Error toast"
            size="sm"
            variant="secondary"
            onPress={() => toast.show('Network error', 'error')}
          />
          <Button
            title="Dialog"
            size="sm"
            variant="secondary"
            onPress={() => setDialog(true)}
          />
          <Button
            title="Bottom sheet"
            size="sm"
            variant="secondary"
            onPress={() => sheetRef.current?.present()}
          />
        </Row>
      </Section>

      <SectionHeader title="Empty & error states" />
      <EmptyState
        icon={Receipt}
        title="No expenses yet"
        message="Add an expense to start splitting."
        actionLabel="Add expense"
        onAction={() => {}}
      />
      <ErrorView onRetry={() => {}} />

      <ConfirmDialog
        visible={dialog}
        title="Delete expense?"
        message="This will remove the expense for everyone in the group."
        confirmLabel="Delete"
        destructive
        onConfirm={() => setDialog(false)}
        onCancel={() => setDialog(false)}
      />
      <BottomSheet ref={sheetRef}>
        <Text variant="title">Choose currency</Text>
        <ListRow title="Indian Rupee" subtitle="INR · ₹" />
        <ListRow title="US Dollar" subtitle="USD · $" />
        <Button
          title="Done"
          fullWidth
          onPress={() => sheetRef.current?.dismiss()}
        />
      </BottomSheet>
    </ScrollView>
  );
}

/** Dev-only showcase of the design system with a local light/dark switch. */
export function ComponentGalleryScreen() {
  const app = useTheme();
  const [dark, setDark] = useState(app.scheme === 'dark');
  const styles = useStyles(createStyles);
  return (
    <ThemeProvider scheme={dark ? 'dark' : 'light'}>
      <View style={styles.flex}>
        <GalleryToolbar dark={dark} onToggle={setDark} />
        <Gallery />
      </View>
    </ThemeProvider>
  );
}

function GalleryToolbar({
  dark,
  onToggle,
}: {
  dark: boolean;
  onToggle: (v: boolean) => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <Row justify="space-between" px="lg" py="sm" style={styles.toolbar}>
      <Text variant="bodyStrong">Dark mode</Text>
      <Switch
        value={dark}
        onValueChange={onToggle}
        accessibilityLabel="Dark mode"
      />
    </Row>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    page: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingBottom: t.spacing.huge },
    toolbar: {
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    swatch: { width: 76, gap: t.spacing.xs },
    chip: {
      height: 40,
      borderRadius: t.radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
  });
