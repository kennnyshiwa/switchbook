import { z } from "zod"
import { validateImageUrl } from "./image-security"

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

export const switchSchema = z.object({
  name: z.string().min(1, "Switch name is required").max(100),
  chineseName: z.string().max(100).optional().or(z.literal("")),
  type: z.enum(["LINEAR", "TACTILE", "CLICKY", "SILENT_LINEAR", "SILENT_TACTILE"]).optional().or(z.literal("")),
  technology: z.enum(["MECHANICAL", "OPTICAL", "MAGNETIC", "INDUCTIVE", "ELECTRO_CAPACITIVE"]).optional().or(z.literal("")),
  magnetOrientation: z.string().max(200).optional().or(z.literal("")),
  magnetPosition: z.string().max(200).optional().or(z.literal("")),
  magnetPolarity: z.string().max(10).optional().or(z.literal("")),
  initialForce: z.number().min(0).max(1000).optional().or(z.nan().transform(() => undefined)),
  initialMagneticFlux: z.number().min(0).max(10000).optional().or(z.nan().transform(() => undefined)),
  bottomOutMagneticFlux: z.number().min(0).max(10000).optional().or(z.nan().transform(() => undefined)),
  pcbThickness: z.string().max(10).optional().or(z.literal("")),
  compatibility: z.string().max(200).optional().or(z.literal("")),
  manufacturer: z.string().max(100).optional().or(z.literal("")),
  springWeight: z.string().optional(),
  springLength: z.string().optional(),
  actuationForce: z.number().min(0).max(1000).optional().or(z.nan().transform(() => undefined)),
  bottomOutForce: z.number().min(0).max(1000).optional().or(z.nan().transform(() => undefined)),
  preTravel: z.number().min(0).max(10).optional().or(z.nan().transform(() => undefined)),
  bottomOut: z.number().min(0).max(10).optional().or(z.nan().transform(() => undefined)),
  notes: z.string().max(500).optional(),
  imageUrl: z.string().optional().or(z.literal("")).refine((url) => {
    if (!url || url === "") return true
    const validation = validateImageUrl(url)
    return validation.valid
  }, {
    message: "Invalid image URL or security violation"
  }),
  topHousing: z.string().max(100).optional().or(z.literal("")),
  bottomHousing: z.string().max(100).optional().or(z.literal("")),
  stem: z.string().max(100).optional().or(z.literal("")),
  frankenTop: z.string().max(100).optional().or(z.literal("")),
  frankenBottom: z.string().max(100).optional().or(z.literal("")),
  frankenStem: z.string().max(100).optional().or(z.literal("")),
  dateObtained: z.string().optional().or(z.literal("")),
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