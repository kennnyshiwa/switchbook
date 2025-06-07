export const SWITCH_TYPE_COLORS = {
  LINEAR: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
  TACTILE: 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200',
  CLICKY: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
  SILENT_LINEAR: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  SILENT_TACTILE: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200',
} as const;

export const SWITCH_TECHNOLOGY_COLORS = {
  MECHANICAL: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
  OPTICAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
  MAGNETIC: 'bg-pink-100 text-pink-800 dark:bg-pink-800 dark:text-pink-200',
  INDUCTIVE: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-800 dark:text-cyan-200',
  ELECTRO_CAPACITIVE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200',
} as const;

export type SwitchType = keyof typeof SWITCH_TYPE_COLORS;
export type SwitchTechnology = keyof typeof SWITCH_TECHNOLOGY_COLORS;