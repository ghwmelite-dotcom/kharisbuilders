export interface Option {
  key: string;
  label: string;
}

export const AREAS: Option[] = [
  { key: 'general', label: 'General / wherever needed' },
  { key: 'kids', label: 'Kids ministry' },
  { key: 'worship', label: 'Worship & music' },
  { key: 'hospitality', label: 'Hospitality & welcome' },
  { key: 'media', label: 'Media & tech' },
  { key: 'parking', label: 'Parking & safety' },
  { key: 'outreach', label: 'Outreach & missions' },
  { key: 'facilities', label: 'Facilities & setup' },
  { key: 'prayer', label: 'Prayer team' },
  { key: 'admin', label: 'Admin & office' },
];

export const COMMITMENTS: Option[] = [
  { key: 'one_time', label: 'One-time' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'as_needed', label: 'As needed / on-call' },
];

export const AREA_KEYS: string[] = AREAS.map((o) => o.key);
export const COMMITMENT_KEYS: string[] = COMMITMENTS.map((o) => o.key);

export function optionLabel(list: Option[], key: string): string {
  return list.find((o) => o.key === key)?.label ?? key;
}
