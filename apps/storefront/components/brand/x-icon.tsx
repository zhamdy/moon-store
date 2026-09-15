import type { SVGProps } from 'react';

export interface XIconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number;
}

/**
 * The X logo, for the footer's social links and the product share row. lucide-react ships
 * only the retired Twitter bird (its `X` is a close cross). Path from Simple Icons (CC0),
 * filled with `currentColor` in the same padded viewBox as `WhatsAppIcon`, so the filled
 * glyphs sit level with the lucide line icons; a passed `strokeWidth` is harmless.
 */
export function XIcon({ size = 24, ...props }: XIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="-3 -3 30 30"
      fill="currentColor"
      {...props}
    >
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  );
}
