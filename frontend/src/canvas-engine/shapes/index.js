// src/canvas-engine/shapes/index.js
// clouds
import { drawClouds, CLOUDS_BASE_PALETTE } from './clouds';
// snow
import { drawSnow, SNOW_BASE_PALETTE } from './snow';
// house
import { drawHouse, HOUSE_BASE_PALETTE } from './house';
// power
import { drawPower, POWER_BASE_PALETTE } from './power';
// villa
import { drawVilla, VILLA_BASE_PALETTE } from './villa';
// car
import { drawCar,   CAR_BASE_PALETTE }   from './car';
// sea
import { drawSea,   SEA_BASE_PALETTE }   from './sea';
// sun
import { drawSun,   SUN_BASE_PALETTE }   from './sun';
// car factory
import { drawCarFactory, CAR_FACTORY_BASE_PALETTE } from './carFactory';
// bus
import { drawBus, BUS_BASE_PALETTE } from './bus';
// trees
import { drawTrees, TREES_BASE_PALETTE } from './trees';

// re-exports
export { drawClouds, CLOUDS_BASE_PALETTE };
export { drawSnow,   SNOW_BASE_PALETTE };
export { drawHouse,  HOUSE_BASE_PALETTE };
export { drawPower,  POWER_BASE_PALETTE };
export { drawVilla,  VILLA_BASE_PALETTE };
export { drawCar,    CAR_BASE_PALETTE };
export { drawSea,    SEA_BASE_PALETTE };
export { drawSun,    SUN_BASE_PALETTE };
export { drawCarFactory, CAR_FACTORY_BASE_PALETTE };
export { drawBus,    BUS_BASE_PALETTE };
export { drawTrees,  TREES_BASE_PALETTE };

// Palettes registry so useColor can blend inherent colors
export const SHAPE_BASE_PALETTES = {
  clouds:     CLOUDS_BASE_PALETTE,
  snow:       SNOW_BASE_PALETTE,
  sun:        SUN_BASE_PALETTE,
  house:      HOUSE_BASE_PALETTE,
  villa:      VILLA_BASE_PALETTE,
  power:      POWER_BASE_PALETTE,
  car:        CAR_BASE_PALETTE,
  sea:        SEA_BASE_PALETTE,
  carFactory: CAR_FACTORY_BASE_PALETTE,
  bus:        BUS_BASE_PALETTE,
  trees:      TREES_BASE_PALETTE,
};

export function getBaseRGB(shape, key = 'default') {
  const pal = SHAPE_BASE_PALETTES[shape];
  if (!pal) return null;
  return pal[key] || pal.default || null;
}
