// components/dotGraph/canvas/shapeFootprints.ts
export const SHAPE_FOOTPRINT: Record<
  | 'clouds' | 'bus' | 'snow' | 'house' | 'power' | 'sun' | 'villa'
  | 'car' | 'sea' | 'carFactory' | 'trees'
, { w: number; h: number }> = {
  clouds: { w: 2, h: 3 },
  bus: { w: 2, h: 1 },
  snow: { w: 1, h: 3 },
  house:{ w: 1, h: 3 },
  power:{ w: 1, h: 3 },
  sun:  { w: 2, h: 2 },
  villa:{ w: 2, h: 3 },
  car:  { w: 1, h: 1 },
  sea:  { w: 2, h: 1 },
  carFactory: { w: 2, h: 2 },
  trees: { w: 1, h: 1 },
};
