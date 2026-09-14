import { describe, expect, it } from 'vitest';
import { productShareLinks } from './share-links';

const url = 'https://moon.example/en/products/silk-midi-dress';
const image = 'https://media.example/p/1.jpg?w=800&q=75';

describe('productShareLinks', () => {
  it('lists the networks in display order', () => {
    expect(productShareLinks({ url, title: 'Dress', image }).map((l) => l.network)).toEqual([
      'facebook',
      'x',
      'pinterest',
      'whatsapp',
      'email',
    ]);
  });

  it('omits Pinterest without an image and keeps the rest in order', () => {
    expect(productShareLinks({ url, title: 'Dress', image: null }).map((l) => l.network)).toEqual([
      'facebook',
      'x',
      'whatsapp',
      'email',
    ]);
  });

  it('encodes spaces, ampersands and the image query string', () => {
    const links = productShareLinks({ url, title: 'Silk & Satin Dress', image });
    const byNetwork = Object.fromEntries(links.map((l) => [l.network, l.href]));
    expect(byNetwork.facebook).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmoon.example%2Fen%2Fproducts%2Fsilk-midi-dress'
    );
    expect(byNetwork.x).toContain('&text=Silk%20%26%20Satin%20Dress');
    expect(byNetwork.pinterest).toContain(
      '&media=https%3A%2F%2Fmedia.example%2Fp%2F1.jpg%3Fw%3D800%26q%3D75&description='
    );
    expect(byNetwork.whatsapp).toBe(
      `https://wa.me/?text=${encodeURIComponent('Silk & Satin Dress')}%20${encodeURIComponent(url)}`
    );
  });

  it('round-trips an Arabic title', () => {
    const title = 'فستان حرير ميدي';
    const x = new URL(
      productShareLinks({ url, title, image }).find((l) => l.network === 'x')!.href
    );
    expect(x.search).not.toMatch(/[؀-ۿ]/);
    expect(x.searchParams.get('text')).toBe(title);
    expect(x.searchParams.get('url')).toBe(url);
  });

  it('builds a mailto with subject and body only', () => {
    const email = productShareLinks({ url, title: 'Silk Dress', image: null }).at(-1)!;
    expect(email.href).toBe(`mailto:?subject=Silk%20Dress&body=${encodeURIComponent(url)}`);
  });
});
