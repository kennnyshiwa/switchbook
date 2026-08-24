import { z } from 'zod'

const optionalText = z.string().trim().max(2000).nullable().optional()
export const proposedSwitchSchema = z.object({
  name: z.string().trim().min(1).max(200),
  manufacturer: z.string().trim().min(1).max(150),
  chineseName: optionalText,
  type: z.enum(['LINEAR','TACTILE','CLICKY','SILENT_LINEAR','SILENT_TACTILE','MOUSE']).nullable().optional(),
  technology: z.enum(['MECHANICAL','OPTICAL','MAGNETIC','INDUCTIVE','ELECTRO_CAPACITIVE']).nullable().optional(),
  initialForce: z.number().min(0).max(500).nullable().optional(), actuationForce: z.number().min(0).max(500).nullable().optional(),
  tactileForce: z.number().min(0).max(500).nullable().optional(), bottomOutForce: z.number().min(0).max(500).nullable().optional(),
  preTravel: z.number().min(0).max(10).nullable().optional(), bottomOut: z.number().min(0).max(10).nullable().optional(),
  tactilePosition: z.number().min(0).max(10).nullable().optional(), springWeight: optionalText, springLength: optionalText,
  progressiveSpring: z.boolean().optional(), doubleStage: z.boolean().optional(), compatibility: optionalText,
  topHousing: optionalText, bottomHousing: optionalText, stem: optionalText, topHousingColor: optionalText,
  bottomHousingColor: optionalText, stemColor: optionalText, stemShape: optionalText, markings: optionalText,
  magnetOrientation: optionalText, magnetPosition: optionalText, magnetPolarity: optionalText,
  initialMagneticFlux: z.number().nullable().optional(), bottomOutMagneticFlux: z.number().nullable().optional(), pcbThickness: optionalText,
  notes: optionalText,
  photos: z.array(z.object({ url: z.string().url().max(2048), alt: z.string().trim().min(1).max(500), sourceUrl: z.string().url().max(2048).optional(), license: z.string().max(100).optional(), attribution: z.string().max(500).optional() })).max(8).default([]),
  submissionNotes: z.string().trim().min(10).max(4000),
  confirmNotDuplicate: z.boolean().default(false),
})

export const correctionSchema = z.object({
  changes: z.record(z.string(), z.unknown()).refine(value => Object.keys(value).length > 0, 'At least one change is required'),
  reason: z.string().trim().min(10).max(4000),
})
