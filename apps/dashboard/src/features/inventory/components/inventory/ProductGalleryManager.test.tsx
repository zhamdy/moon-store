import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../../shared/lib/transport';
import {
  ApiError,
  type Transport,
  type TransportRequest,
} from '../../../../shared/lib/transport/types';
import { useSettingsStore } from '../../../../shared/store/settingsStore';
import type { ProductImage } from '../../types';
import { moveImageIds } from '../../lib/gallery';
import ProductGalleryManager from './ProductGalleryManager';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const image = (id: number, position: number): ProductImage => ({
  id,
  product_id: 1,
  image_url: `/uploads/products/${id}.jpg`,
  position,
  created_at: '2026-09-14',
});

/**
 * A fake of the four gallery routes. The memory transport addresses records, not
 * sub-collections, so it cannot answer `products/1/images/order` with a list.
 */
function galleryTransport(initial: ProductImage[], failures: Record<string, ApiError> = {}) {
  let images = [...initial];
  const calls: TransportRequest[] = [];
  const transport: Transport = {
    async request<T>(req: TransportRequest) {
      calls.push(req);
      const failure = failures[`${req.method} ${req.path}`];
      if (failure) throw failure;
      if (req.method === 'GET') return { data: images as T };
      if (req.method === 'POST') {
        const created = image(100 + images.length, images.length);
        images = [...images, created];
        return { data: created as T };
      }
      if (req.method === 'PUT') {
        const { imageIds } = req.body as { imageIds: number[] };
        images = imageIds.map((id, position) => ({
          ...images.find((i) => i.id === id)!,
          position,
        }));
        return { data: images as T };
      }
      images = images.filter((i) => !req.path.endsWith(`/${i.id}`));
      return { data: undefined as T };
    },
  };
  return { transport, calls };
}

function renderGallery(transport: Transport) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
  return render(<ProductGalleryManager productId={1} productName="Silk Dress" />, { wrapper });
}

const altTexts = () => screen.getAllByRole('img').map((img) => img.getAttribute('alt'));

describe('moveImageIds', () => {
  it('swaps with the neighbour and ignores a move off either end', () => {
    expect(moveImageIds([10, 11, 12], 0, 1)).toEqual([11, 10, 12]);
    expect(moveImageIds([10, 11, 12], 2, -1)).toEqual([10, 12, 11]);
    expect(moveImageIds([10, 11, 12], 0, -1)).toEqual([10, 11, 12]);
  });
});

describe('ProductGalleryManager', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('renders the images in position order', async () => {
    const { transport } = galleryTransport([image(12, 2), image(10, 0), image(11, 1)]);
    renderGallery(transport);

    await screen.findByRole('list', { name: 'Gallery images, in display order' });
    const srcs = screen.getAllByRole('img').map((img) => img.getAttribute('src'));
    expect(srcs.map((src) => src?.match(/(\d+)\.jpg$/)?.[1])).toEqual(['10', '11', '12']);
    expect(altTexts()).toEqual([
      'Silk Dress, gallery image 1',
      'Silk Dress, gallery image 2',
      'Silk Dress, gallery image 3',
    ]);
  });

  it('commits "move later" on the first image as the swapped id list', async () => {
    const { transport, calls } = galleryTransport([image(10, 0), image(11, 1), image(12, 2)]);
    renderGallery(transport);

    fireEvent.click(await screen.findByRole('button', { name: 'Move image 1 later' }));

    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          method: 'PUT',
          path: 'products/1/images/order',
          body: { imageIds: [11, 10, 12] },
        })
      )
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole('img').map((img) => img.getAttribute('src')?.match(/(\d+)\.jpg$/)?.[1])
      ).toEqual(['11', '10', '12'])
    );
  });

  it('disables "move earlier" on the first image and "move later" on the last', async () => {
    const { transport } = galleryTransport([image(10, 0), image(11, 1), image(12, 2)]);
    renderGallery(transport);

    expect(await screen.findByRole('button', { name: 'Move image 1 earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move image 3 later' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move image 2 earlier' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move image 2 later' })).toBeEnabled();
  });

  it('disables upload at eight images and says why', async () => {
    const eight = Array.from({ length: 8 }, (_, i) => image(10 + i, i));
    const { transport } = galleryTransport(eight);
    renderGallery(transport);

    const add = await screen.findByRole('button', { name: 'Add image' });
    await waitFor(() => expect(add).toBeDisabled());
    const reason = screen.getByText(
      'The gallery is full (8 images). Remove an image to add another.'
    );
    expect(add).toHaveAttribute('aria-describedby', reason.id);
  });

  /**
   * The server phrases an upload refusal for the operator, so showing it beats the
   * generic sentence: "too big" and "wrong format" are different problems with different
   * fixes, and the operator used to be told neither (HIGH-5).
   */
  it('shows the server reason and leaves the list unchanged when an upload fails', async () => {
    const { transport, calls } = galleryTransport([image(10, 0), image(11, 1)], {
      'POST products/1/images': new ApiError(
        'Only JPEG, PNG, and WebP images are allowed',
        400,
        'VALIDATION_ERROR'
      ),
    });
    const { container } = renderGallery(transport);
    await screen.findByRole('list', { name: 'Gallery images, in display order' });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'look.gif', { type: 'image/gif' })] },
    });

    expect(
      await screen.findByText('Only JPEG, PNG, and WebP images are allowed')
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('shows the size limit when the image is too large', async () => {
    const { transport } = galleryTransport([image(10, 0)], {
      'POST products/1/images': new ApiError('Image must be at most 2 MB', 413, 'VALIDATION_ERROR'),
    });
    const { container } = renderGallery(transport);
    await screen.findByRole('list', { name: 'Gallery images, in display order' });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'huge.png', { type: 'image/png' })] },
    });

    expect(await screen.findByText('Image must be at most 2 MB')).toBeInTheDocument();
  });

  it('names the controls in Arabic too', async () => {
    useSettingsStore.setState({ locale: 'ar' });
    const { transport } = galleryTransport([image(10, 0), image(11, 1)]);
    renderGallery(transport);

    expect(
      await screen.findByRole('button', {
        name: '\u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 2',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: '\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 1',
      })
    ).toBeInTheDocument();
  });
});
