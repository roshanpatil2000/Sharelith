import { Plane, List } from 'lucide-react-native';
import {
  asGroupType,
  groupTypeIcon,
  groupTypeLabel,
  memberCountLabel,
} from '../groupTypes';

describe('groupTypes', () => {
  it('labels and icons each type', () => {
    expect(groupTypeLabel('trip')).toBe('Trip');
    expect(groupTypeIcon('trip')).toBe(Plane);
  });

  it('treats unknown types as other', () => {
    expect(asGroupType('boat')).toBe('other');
    expect(groupTypeLabel('boat')).toBe('Other');
    expect(groupTypeIcon('boat')).toBe(List);
  });

  it('counts people', () => {
    expect(memberCountLabel(1)).toBe('1 person');
    expect(memberCountLabel(4)).toBe('4 people');
  });
});
