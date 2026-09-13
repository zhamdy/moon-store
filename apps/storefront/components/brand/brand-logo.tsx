import Image from 'next/image';
import { logoAssets, type LogoVariant } from '@/lib/brand/logo-assets';

export interface BrandLogoProps {
  variant: LogoVariant;
  height: number;
  /** Emits a <link rel="preload"> in <head> (Next 16's replacement for `priority`). */
  preload?: boolean;
  className?: string;
}

/** Renders at its intrinsic aspect ratio — width is derived, never set independently. */
export function BrandLogo({ variant, height, preload, className }: BrandLogoProps) {
  const asset = logoAssets[variant];
  const width = Math.round((asset.width / asset.height) * height);

  return (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={width}
      height={height}
      preload={preload}
      className={className}
    />
  );
}
