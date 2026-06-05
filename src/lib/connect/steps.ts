export interface NextStep {
  key: string;
  label: string;
}

/** The canonical "next step" options shown on the connect card. One source of truth. */
export const NEXT_STEPS: NextStep[] = [
  { key: 'new', label: "I'm new here" },
  { key: 'decision', label: 'I made a decision to follow Jesus' },
  { key: 'rededicate', label: 'I recommitted my life' },
  { key: 'baptism', label: "I'd like to be baptized" },
  { key: 'membership', label: 'I want to become a member' },
  { key: 'group', label: "I'd like to join a group" },
  { key: 'serve', label: 'I want to serve / volunteer' },
  { key: 'prayer', label: "I'd like prayer or a call from a pastor" },
];

export const STEP_KEYS: string[] = NEXT_STEPS.map((s) => s.key);

export function stepLabel(key: string): string {
  return NEXT_STEPS.find((s) => s.key === key)?.label ?? key;
}
