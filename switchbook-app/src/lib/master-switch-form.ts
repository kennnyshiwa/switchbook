import { switchSchema } from './validation'
import { MASTER_TRACKED_FIELDS } from './master-switch-modifications'
/** Apply every catalog spec to a form, including explicit clears and zero. */
export function masterFieldsToForm(master: Record<string, unknown>) {
  return switchSchema.partial().parse(Object.fromEntries(MASTER_TRACKED_FIELDS.map(key => [key, master[key]])))
}
