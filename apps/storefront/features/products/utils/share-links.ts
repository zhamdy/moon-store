export type ShareNetwork = 'facebook' | 'x' | 'pinterest' | 'whatsapp' | 'email';

export interface ShareLink {
  network: ShareNetwork;
  href: string;
}

export interface ShareInput {
  /** The absolute product URL. */
  url: string;
  title: string;
  /** The first image, already absolute; `null` drops Pinterest, which needs an image. */
  image: string | null;
}

const enc = encodeURIComponent;

/**
 * The share links in display order. Plain URLs to each network's own share endpoint, so
 * the row needs no SDK and no client JS. Every parameter is percent-encoded, which keeps
 * Arabic titles and a `&` in a name intact.
 */
export function productShareLinks({ url, title, image }: ShareInput): ShareLink[] {
  const links: ShareLink[] = [
    { network: 'facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { network: 'x', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
  ];
  if (image) {
    links.push({
      network: 'pinterest',
      href: `https://pinterest.com/pin/create/button/?url=${enc(url)}&media=${enc(image)}&description=${enc(title)}`,
    });
  }
  links.push(
    { network: 'whatsapp', href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { network: 'email', href: `mailto:?subject=${enc(title)}&body=${enc(url)}` }
  );
  return links;
}
