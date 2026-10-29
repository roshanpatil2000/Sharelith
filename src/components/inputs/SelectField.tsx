import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Check, type LucideIcon } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { BottomSheet } from '../feedback/BottomSheet';
import { ListRow } from '../display/ListRow';
import { Icon } from '../primitives/Icon';
import { Text } from '../primitives/Text';
import { SearchBar } from './SearchBar';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Secondary text, also matched by search. */
  description?: string;
};

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  icon?: LucideIcon;
  /** Shows a search field when the list is long. */
  searchable?: boolean;
  disabled?: boolean;
  testID?: string;
};

/**
 * A row showing the current choice; tapping it opens a bottom sheet of
 * options. Used for currency, time zone and similar settings.
 */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  searchable = false,
  disabled = false,
  testID,
}: Props<T>) {
  const styles = useStyles(createStyles);
  const sheet = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState('');
  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter(o =>
      `${o.label} ${o.description ?? ''} ${o.value}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <>
      <ListRow
        testID={testID}
        title={label}
        leading={icon ? <Icon icon={icon} color="textSecondary" /> : undefined}
        trailing={
          <Text color="textSecondary" numberOfLines={1}>
            {selected?.label ?? value}
          </Text>
        }
        chevron
        onPress={disabled ? undefined : () => sheet.current?.present()}
      />
      <BottomSheet
        ref={sheet}
        scrollable={options.length > 8}
        onDismiss={() => setQuery('')}
        header={
          <>
            <Text variant="title">{label}</Text>
            {searchable ? (
              <SearchBar
                value={query}
                onChangeText={setQuery}
                testID={testID ? `${testID}-search` : undefined}
              />
            ) : null}
          </>
        }
      >
        {filtered.map(o => (
          <ListRow
            key={o.value}
            testID={testID ? `${testID}-option-${o.value}` : undefined}
            title={o.label}
            subtitle={o.description}
            trailing={
              o.value === value ? <Icon icon={Check} color="primary" /> : null
            }
            onPress={() => {
              onChange(o.value);
              sheet.current?.dismiss();
            }}
          />
        ))}
        {filtered.length === 0 ? (
          <Text color="textSecondary" align="center" style={styles.empty}>
            No matches for “{query.trim()}”
          </Text>
        ) : null}
      </BottomSheet>
    </>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    empty: { padding: t.spacing.xxl },
  });
