import { SwitchType } from '@prisma/client';

interface SwitchData {
  name: string;
  type: SwitchType;
  manufacturer: string;
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
    type: data.type,
    manufacturer: data.manufacturer,
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