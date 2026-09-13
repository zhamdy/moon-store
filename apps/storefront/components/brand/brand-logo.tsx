import Image from 'next/image';
import { logoAssets, type LogoVariant } from '@/lib/brand/logo-assets';

export interface BrandLogoProps {
  variant: LogoVariant;
  height: number;
  priority?: boolean;
  className?: string;
}

/** Renders at its intrinsic aspect ratio — width is derived, never set independently. */
export function BrandLogo({ variant, height, priority, className }: BrandLogoProps) {
  const asset = logoAssets[variant];
  const width = Math.round((asset.width / asset.height) * height);

  return (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
