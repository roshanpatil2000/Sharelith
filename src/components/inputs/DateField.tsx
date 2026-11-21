import React, { useRef, useState } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Platform } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import {
  friendlyDate,
  fromISODate,
  toISODate,
  type ISODate,
} from '@/domain/dates';
import { Icon } from '../primitives/Icon';
import { Text } from '../primitives/Text';
import { ListRow } from '../display/ListRow';
import { BottomSheet } from '../feedback/BottomSheet';
import { Button } from './Button';

type Props = {
  label: string;
  value: ISODate;
  onChange: (day: ISODate) => void;
  /** Latest day that can be picked. */
  maximum?: ISODate;
  testID?: string;
};

/**
 * A row showing a day ("Today", "21 Nov 2026"); tapping it opens the system
 * date picker (a dialog on Android, a sheet on iOS).
 */
export function DateField({ label, value, onChange, maximum, testID }: Props) {
  const sheet = useRef<BottomSheetModal>(null);
  const [draft, setDraft] = useState(fromISODate(value));
  const maximumDate = maximum ? fromISODate(maximum) : undefined;

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromISODate(value),
        mode: 'date',
        maximumDate,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) {
            onChange(toISODate(date));
          }
        },
      });
    } else {
      setDraft(fromISODate(value));
      sheet.current?.present();
    }
  };

  return (
    <>
      <ListRow
        testID={testID}
        title={label}
        leading={<Icon icon={Calendar} color="textSecondary" />}
        trailing={<Text color="textSecondary">{friendlyDate(value)}</Text>}
        chevron
        onPress={open}
      />
      {Platform.OS === 'ios' ? (
        <BottomSheet ref={sheet} header={<Text variant="title">{label}</Text>}>
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            maximumDate={maximumDate}
            onChange={(_e, date) => date && setDraft(date)}
            testID={testID ? `${testID}-picker` : undefined}
          />
          <Button
            title="Done"
            fullWidth
            onPress={() => {
              onChange(toISODate(draft));
              sheet.current?.dismiss();
            }}
            testID={testID ? `${testID}-done` : undefined}
          />
        </BottomSheet>
      ) : null}
    </>
  );
}
