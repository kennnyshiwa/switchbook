import { z } from "zod"

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
})

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

export const QUANTITY_MAX = 1_000_000

// Collection text is PostgreSQL text, as are catalog/legacy values. Do not
// impose shorter collection-only caps that make valid snapshots uneditable.
const optionalText = z.string().nullable().transform(value => value ?? '').optional()
const optionalMeasurement = z.number().finite().nullable().transform(value => value ?? NaN).optional().or(z.nan())

/**
 * Parse a user-typed quantity. Blank clears it (null); whole numbers from 0 to
 * QUANTITY_MAX are accepted, including forms like "1.0"; anything else
 * (negative, fractional, "1,000", text) is rejected.
 */
export function parseQuantityInput(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  if (!/^\+?\d+(\.0+)?$/.test(trimmed)) return { ok: false }
  const value = Number(trimmed)
  return value <= QUANTITY_MAX ? { ok: true, value } : { ok: false }
}

// How many of this switch the user owns. Optional and nullable: blank form
// input (NaN from valueAsNumber, or an empty string) clears it to null, and a
// numeric string from CSV/JSON clients is accepted as a number.
export const quantitySchema = z.preprocess(value => {
  if (value === null || value === undefined) return value
  if (typeof value === 'number') return Number.isNaN(value) ? null : value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    return /^[+-]?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : value
  }
  return value
}, z.number({ invalid_type_error: 'Quantity must be a whole number' })
  .int('Quantity must be a whole number')
  .min(0, 'Quantity cannot be negative')
  .max(QUANTITY_MAX, 'Quantity is too large')
  .nullable()
  .optional())

export const switchSchema = z.object({
  name: z.string().min(1, "Switch name is required"),
  chineseName: optionalText,
  type: z.enum(["LINEAR", "TACTILE", "CLICKY", "SILENT_LINEAR", "SILENT_TACTILE", "MOUSE"]).nullable().transform(value => value ?? "").optional().or(z.literal("")),
  technology: z.enum(["MECHANICAL", "OPTICAL", "MAGNETIC", "INDUCTIVE", "ELECTRO_CAPACITIVE"]).nullable().transform(value => value ?? "").optional().or(z.literal("")),
  magnetOrientation: optionalText,
  magnetPosition: optionalText,
  magnetPolarity: optionalText,
  initialForce: optionalMeasurement,
  initialMagneticFlux: optionalMeasurement,
  bottomOutMagneticFlux: optionalMeasurement,
  pcbThickness: optionalText,
  compatibility: optionalText,
  manufacturer: optionalText,
  springWeight: optionalText,
  springLength: optionalText,
  actuationForce: optionalMeasurement,
  tactileForce: optionalMeasurement,
  bottomOutForce: optionalMeasurement,
  progressiveSpring: z.boolean().optional(),
  doubleStage: z.boolean().optional(),
  preTravel: optionalMeasurement,
  bottomOut: optionalMeasurement,
  notes: optionalText,
  personalNotes: optionalText,
  topHousing: optionalText,
  bottomHousing: optionalText,
  stem: optionalText,
  frankenTop: optionalText,
  frankenBottom: optionalText,
  frankenStem: optionalText,
  clickType: z.enum(["CLICK_LEAF", "CLICK_BAR", "CLICK_JACKET"]).nullable().transform(value => value ?? "").optional().or(z.literal("")),
  tactilePosition: optionalMeasurement,
  dateObtained: optionalText.refine(value => !value || !Number.isNaN(new Date(value).getTime()), "Invalid date"),
  // Absent means "leave unchanged" on update; creates get the column default [].
  personalTags: z.array(z.string()).optional(),
  quantity: quantitySchema,
  topHousingColor: optionalText,
  bottomHousingColor: optionalText,
  stemColor: optionalText,
  stemShape: optionalText,
  markings: optionalText,
})

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export const passwordResetSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// Image upload validation
export const imageUploadSchema = z.object({
  caption: z.string().max(200).optional(),
  order: z.number().int().min(0).optional()
})

export const reorderImagesSchema = z.object({
  images: z.array(z.object({
    id: z.string(),
    order: z.number().int().min(0)
  }))
})
