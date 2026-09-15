export type ShareNetwork = 'x' | 'whatsapp';

export interface ShareLink {
  network: ShareNetwork;
  href: string;
}

export interface ShareInput {
  /** The absolute product URL. */
  url: string;
  title: string;
}

const enc = encodeURIComponent;

/**
 * The direct share links in display order. Plain URLs to each network's own share
 * endpoint, so they need no SDK and no client JS. Every parameter is percent-encoded,
 * which keeps Arabic titles and a `&` in a name intact. Every other app (Instagram,
 * TikTok, Messenger) is reached through the device share sheet, not a link.
 */
export function productShareLinks({ url, title }: ShareInput): ShareLink[] {
  return [
    { network: 'x', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { network: 'whatsapp', href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
  ];
}
