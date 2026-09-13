import { domAnimation } from 'motion/react';

/**
 * Loaded asynchronously by `Parallax`'s leaf-scoped `LazyMotion`, so the
 * ~8 KB gz animation bundle is fetched only where a parallax element renders —
 * not in the initial JS. No global `LazyMotion`/`MotionConfig` provider exists.
 */
export default domAnimation;
