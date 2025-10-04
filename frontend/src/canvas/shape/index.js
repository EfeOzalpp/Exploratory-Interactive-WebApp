// clouds
import { drawClouds, CLOUDS_BASE_PALETTE } from './clouds';
// snow
import { drawSnow, SNOW_BASE_PALETTE } from './snow';
// shapes
import { drawHouse, HOUSE_BASE_PALETTE } from './house';
import { drawPower, POWER_BASE_PALETTE } from './power'; // new
import { drawVilla, VILLA_BASE_PALETTE } from './villa';
import { drawPlus } from './plus';
// sun
import { drawSun, SUN_BASE_PALETTE } from './sun';

// re-exports
export { drawClouds, CLOUDS_BASE_PALETTE };
export { drawSnow, SNOW_BASE_PALETTE };
export { drawHouse, HOUSE_BASE_PALETTE };
export { drawPower, POWER_BASE_PALETTE };   // new
export { drawVilla, VILLA_BASE_PALETTE };
export { drawPlus };
export { drawSun, SUN_BASE_PALETTE };

// Palettes registry so useColor can blend inherent colors
export const SHAPE_BASE_PALETTES = {
  clouds: CLOUDS_BASE_PALETTE,
  snow: SNOW_BASE_PALETTE,
  sun: SUN_BASE_PALETTE,
  house: HOUSE_BASE_PALETTE,
  villa: VILLA_BASE_PALETTE,
  power: POWER_BASE_PALETTE,   // new
};

export function getBaseRGB(shape, key = 'default') {
  const pal = SHAPE_BASE_PALETTES[shape];
  if (!pal) return null;
  return pal[key] || pal.default || null;
}
