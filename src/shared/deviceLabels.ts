// Crew devices are picked from this fixed list so no free text is ever typed (FR-014, FR-016).
export const DEVICE_LABELS = [
  ...Array.from({ length: 12 }, (_, i) => `Crew phone ${i + 1}`),
  "Tablet A",
  "Tablet B",
] as const;
export type DeviceLabel = (typeof DEVICE_LABELS)[number];
