import Image from 'next/image';
import { logoAssets } from '@/lib/brand/logo-assets';

/** The missing-image mark's rendered width; its height follows the asset's ratio. */
const MARK_WIDTH = 40;

/**
 * Fills a `relative` image frame when a product has no photograph: the brand mark, small
 * and faint, so a missing image never reads as a loading skeleton.
 */
export function ProductImagePlaceholder() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
      <Image
        src={logoAssets.mark.src}
        alt=""
        width={MARK_WIDTH}
        height={Math.round((logoAssets.mark.height / logoAssets.mark.width) * MARK_WIDTH)}
        className="opacity-15"
      />
    </div>
  );
}
