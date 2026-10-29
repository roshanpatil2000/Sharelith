/** IANA time zone of the device, e.g. "Asia/Kolkata". */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/** Common zones offered in the picker; the device zone is added if missing. */
export const commonTimezones = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Karachi',
  'Asia/Colombo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Istanbul',
  'Africa/Johannesburg',
  'Africa/Nairobi',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'UTC',
] as const;

export function timezoneOptions(current?: string): string[] {
  const zones: string[] = [...commonTimezones];
  for (const z of [deviceTimezone(), current]) {
    if (z && !zones.includes(z)) {
      zones.unshift(z);
    }
  }
  return zones;
}

/** "Asia/Kolkata" → "Kolkata (Asia)". */
export function timezoneLabel(zone: string): string {
  const parts = zone.split('/');
  if (parts.length < 2) {
    return zone;
  }
  const city = parts[parts.length - 1]!.replace(/_/g, ' ');
  return `${city} (${parts[0]})`;
}
