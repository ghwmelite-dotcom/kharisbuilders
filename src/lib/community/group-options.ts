export interface Option {
  key: string;
  label: string;
}

export const DAYS: Option[] = [
  { key: 'Sunday', label: 'Sunday' },
  { key: 'Monday', label: 'Monday' },
  { key: 'Tuesday', label: 'Tuesday' },
  { key: 'Wednesday', label: 'Wednesday' },
  { key: 'Thursday', label: 'Thursday' },
  { key: 'Friday', label: 'Friday' },
  { key: 'Saturday', label: 'Saturday' },
  { key: 'Various', label: 'Various / flexible' },
];

export const FORMATS: Option[] = [
  { key: 'in_person', label: 'In person' },
  { key: 'online', label: 'Online' },
  { key: 'hybrid', label: 'Hybrid' },
];

export const AUDIENCES: Option[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'men', label: 'Men' },
  { key: 'women', label: 'Women' },
  { key: 'young_adults', label: 'Young adults' },
  { key: 'couples', label: 'Couples' },
  { key: 'youth', label: 'Youth' },
  { key: 'seniors', label: 'Seniors' },
  { key: 'families', label: 'Families' },
];

export const FORMAT_KEYS: string[] = FORMATS.map((o) => o.key);
export const AUDIENCE_KEYS: string[] = AUDIENCES.map((o) => o.key);

export function optionLabel(list: Option[], key: string): string {
  return list.find((o) => o.key === key)?.label ?? key;
}
