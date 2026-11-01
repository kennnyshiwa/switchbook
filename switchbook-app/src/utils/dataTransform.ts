import { SwitchType, SwitchTechnology, ClickType } from '@prisma/client';

interface SwitchData {
  name: string;
  chineseName?: string | null;
  type?: SwitchType | null | '';
  technology?: SwitchTechnology | null | '';
  magnetOrientation?: string | null;
  magnetPosition?: string | null;
  magnetPolarity?: string | null;
  initialForce?: number | null;
  initialMagneticFlux?: number | null;
  bottomOutMagneticFlux?: number | null;
  pcbThickness?: string | null;
  compatibility?: string | null;
  manufacturer?: string | null;
  springWeight?: string | null;
  springLength?: string | null;
  actuationForce?: number | null;
  tactileForce?: number | null;
  tactilePosition?: number | null;
  bottomOutForce?: number | null;
  progressiveSpring?: boolean | null;
  doubleStage?: boolean | null;
  preTravel?: number | null;
  bottomOut?: number | null;
  notes?: string | null;
  personalNotes?: string | null;
  topHousing?: string | null;
  bottomHousing?: string | null;
  stem?: string | null;
  topHousingColor?: string | null;
  bottomHousingColor?: string | null;
  stemColor?: string | null;
  stemShape?: string | null;
  markings?: string | null;
  frankenTop?: string | null;
  frankenBottom?: string | null;
  frankenStem?: string | null;
  clickType?: ClickType | null | '';
  dateObtained?: string | null;
  personalTags?: string[];
  quantity?: number | null;
}

// Keep 0 (a real measurement); blank/NaN/undefined from forms become null.
function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function transformSwitchData(data: SwitchData) {
  return {
    name: data.name,
    chineseName: data.chineseName || null,
    type: data.type === '' ? null : (data.type || null),
    technology: data.technology === '' ? null : (data.technology || null),
    magnetOrientation: data.magnetOrientation || null,
    magnetPosition: data.magnetPosition || null,
    magnetPolarity: data.magnetPolarity || null,
    initialForce: numberOrNull(data.initialForce),
    initialMagneticFlux: numberOrNull(data.initialMagneticFlux),
    bottomOutMagneticFlux: numberOrNull(data.bottomOutMagneticFlux),
    pcbThickness: data.pcbThickness || null,
    compatibility: data.compatibility || null,
    manufacturer: data.manufacturer || null,
    springWeight: data.springWeight || null,
    springLength: data.springLength || null,
    actuationForce: numberOrNull(data.actuationForce),
    tactileForce: numberOrNull(data.tactileForce),
    tactilePosition: numberOrNull(data.tactilePosition),
    bottomOutForce: numberOrNull(data.bottomOutForce),
    progressiveSpring: data.progressiveSpring || false,
    doubleStage: data.doubleStage || false,
    preTravel: numberOrNull(data.preTravel),
    bottomOut: numberOrNull(data.bottomOut),
    notes: data.notes || null,
    // personalNotes, personalTags and quantity are user-only fields that some clients (e.g.
    // the bulk-edit grid) do not carry. When the key is absent, return
    // undefined so Prisma updates leave the stored value untouched; creates
    // fall back to the column default (null).
    personalNotes: data.personalNotes === undefined ? undefined : (data.personalNotes || null),
    topHousing: data.topHousing || null,
    bottomHousing: data.bottomHousing || null,
    stem: data.stem || null,
    topHousingColor: data.topHousingColor || null,
    bottomHousingColor: data.bottomHousingColor || null,
    stemColor: data.stemColor || null,
    stemShape: data.stemShape || null,
    markings: data.markings || null,
    frankenTop: data.frankenTop || null,
    frankenBottom: data.frankenBottom || null,
    frankenStem: data.frankenStem || null,
    clickType: data.clickType === '' ? null : (data.clickType || null),
    dateObtained: data.dateObtained ? new Date(data.dateObtained) : null,
    personalTags: data.personalTags === undefined ? undefined : data.personalTags,
    quantity: data.quantity === undefined ? undefined : (data.quantity ?? null),
  };
}