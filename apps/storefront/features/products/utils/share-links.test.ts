import { describe, expect, it } from 'vitest';
import { productShareLinks } from './share-links';

const url = 'https://moon.example/en/products/silk-midi-dress';

describe('productShareLinks', () => {
  it('lists X then WhatsApp and nothing else', () => {
    expect(productShareLinks({ url, title: 'Dress' }).map((l) => l.network)).toEqual([
      'x',
      'whatsapp',
    ]);
  });

  it('encodes spaces and ampersands', () => {
    const links = productShareLinks({ url, title: 'Silk & Satin Dress' });
    const byNetwork = Object.fromEntries(links.map((l) => [l.network, l.href]));
    expect(byNetwork.x).toBe(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=Silk%20%26%20Satin%20Dress`
    );
    expect(byNetwork.whatsapp).toBe(
      `https://wa.me/?text=${encodeURIComponent('Silk & Satin Dress')}%20${encodeURIComponent(url)}`
    );
  });

  it('round-trips an Arabic title', () => {
    const title = 'فستان حرير ميدي';
    const [x, whatsapp] = productShareLinks({ url, title }).map((l) => new URL(l.href));
    expect(x.search).not.toMatch(/[؀-ۿ]/);
    expect(x.searchParams.get('text')).toBe(title);
    expect(x.searchParams.get('url')).toBe(url);
    expect(whatsapp.search).not.toMatch(/[؀-ۿ]/);
    expect(whatsapp.searchParams.get('text')).toBe(`${title} ${url}`);
  });

  it('never builds a mailto, Facebook or Pinterest link', () => {
    const hrefs = productShareLinks({ url, title: 'Dress' })
      .map((l) => l.href)
      .join(' ');
    expect(hrefs).not.toMatch(/mailto:|facebook|pinterest/);
  });
});
