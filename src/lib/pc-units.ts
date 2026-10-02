export const PC_UNITS = [
  { id: 'kg', en: 'Kilogram (kg)', es: 'Kilogramo (kg)' },
  { id: 'lb', en: 'Pound (lb)', es: 'Libra (lb)' },
  { id: 'g', en: 'Gram (g)', es: 'Gramo (g)' },
  { id: 'l', en: 'Liter (L)', es: 'Litro (L)' },
  { id: 'ml', en: 'Milliliter (mL)', es: 'Mililitro (mL)' },
  { id: 'unit', en: 'Piece (pc)', es: 'Pieza (pza)' },
] as const;
export type PCUnit = (typeof PC_UNITS)[number]['id'];
export const isPCUnit = (v: unknown): v is PCUnit =>
  typeof v === 'string' && PC_UNITS.some(unit => unit.id === v);
