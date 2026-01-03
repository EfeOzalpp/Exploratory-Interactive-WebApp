// graph-runtime/sprites/api/dispose.ts
import { disposeAllSpriteTextures } from '../internal/spriteRuntime.ts';

export { disposeAllSpriteTextures };

if (typeof window !== 'undefined') {
  (window as any).__GP_DISPOSE_TEX = disposeAllSpriteTextures;
}
