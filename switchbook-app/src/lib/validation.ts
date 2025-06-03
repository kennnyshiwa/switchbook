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

export const switchSchema = z.object({
  name: z.string().min(1, "Switch name is required").max(100),
  type: z.enum(["LINEAR", "TACTILE", "CLICKY", "SILENT_LINEAR", "SILENT_TACTILE"]),
  manufacturer: z.string().min(1, "Manufacturer is required").max(100),
  springWeight: z.string().optional(),
  springLength: z.string().optional(),
  actuationForce: z.number().min(0).max(1000).optional(),
  bottomOutForce: z.number().min(0).max(1000).optional(),
  preTravel: z.number().min(0).max(10).optional(),
  bottomOut: z.number().min(0).max(10).optional(),
  travel: z.string().optional(),
  notes: z.string().max(500).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  topHousing: z.string().max(100).optional().or(z.literal("")),
  bottomHousing: z.string().max(100).optional().or(z.literal("")),
  stem: z.string().max(100).optional().or(z.literal("")),
  dateObtained: z.string().optional().or(z.literal("")),
})