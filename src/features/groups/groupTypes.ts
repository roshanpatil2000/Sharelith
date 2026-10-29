import {
  Heart,
  House,
  List,
  Plane,
  type LucideIcon,
} from 'lucide-react-native';

export const GROUP_TYPES = ['trip', 'home', 'couple', 'other'] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

const meta: Record<GroupType, { label: string; icon: LucideIcon }> = {
  trip: { label: 'Trip', icon: Plane },
  home: { label: 'Home', icon: House },
  couple: { label: 'Couple', icon: Heart },
  other: { label: 'Other', icon: List },
};

export function groupTypeLabel(type: string): string {
  return meta[asGroupType(type)].label;
}

export function groupTypeIcon(type: string): LucideIcon {
  return meta[asGroupType(type)].icon;
}

/** Unknown values (e.g. from a newer server) fall back to "other". */
export function asGroupType(type: string): GroupType {
  return (GROUP_TYPES as readonly string[]).includes(type)
    ? (type as GroupType)
    : 'other';
}

export function memberCountLabel(count: number): string {
  return count === 1 ? '1 person' : `${count} people`;
}
