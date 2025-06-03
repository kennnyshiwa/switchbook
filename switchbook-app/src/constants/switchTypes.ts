export const SWITCH_TYPE_COLORS = {
  LINEAR: 'bg-red-100 text-red-800',
  TACTILE: 'bg-amber-100 text-amber-800',
  CLICKY: 'bg-blue-100 text-blue-800',
  SILENT_LINEAR: 'bg-gray-100 text-gray-800',
  SILENT_TACTILE: 'bg-purple-100 text-purple-800',
} as const;

export type SwitchType = keyof typeof SWITCH_TYPE_COLORS;