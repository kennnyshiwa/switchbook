export const SWITCH_TYPE_COLORS = {
  LINEAR: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
  TACTILE: 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200',
  CLICKY: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
  SILENT_LINEAR: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  SILENT_TACTILE: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200',
} as const;

export type SwitchType = keyof typeof SWITCH_TYPE_COLORS;