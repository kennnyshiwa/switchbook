import { SwitchType, SwitchTechnology } from '@prisma/client';

interface SwitchData {
  name: string;
  chineseName?: string | null;
  type?: SwitchType | null | '';
  technology?: SwitchTechnology | null | '';
  magnetOrientation?: string | null;
  magnetPosition?: string | null;
  magnetStrength?: number | null;
  compatibility?: string | null;
  manufacturer?: string | null;
  springWeight?: string | null;
  springLength?: string | null;
  actuationForce?: number | null;
  bottomOutForce?: number | null;
  preTravel?: number | null;
  bottomOut?: number | null;
  notes?: string | null;
  imageUrl?: string | null;
  topHousing?: string | null;
  bottomHousing?: string | null;
  stem?: string | null;
  dateObtained?: string | null;
}

export function transformSwitchData(data: SwitchData) {
  return {
    name: data.name,
    chineseName: data.chineseName || null,
    type: data.type === '' ? null : (data.type || null),
    technology: data.technology === '' ? null : (data.technology || null),
    magnetOrientation: data.magnetOrientation || null,
    magnetPosition: data.magnetPosition || null,
    magnetStrength: data.magnetStrength || null,
    compatibility: data.compatibility || null,
    manufacturer: data.manufacturer || null,
    springWeight: data.springWeight || null,
    springLength: data.springLength || null,
    actuationForce: data.actuationForce || null,
    bottomOutForce: data.bottomOutForce || null,
    preTravel: data.preTravel || null,
    bottomOut: data.bottomOut || null,
    notes: data.notes || null,
    imageUrl: data.imageUrl || null,
    topHousing: data.topHousing || null,
    bottomHousing: data.bottomHousing || null,
    stem: data.stem || null,
    dateObtained: data.dateObtained ? new Date(data.dateObtained) : null,
  };
}