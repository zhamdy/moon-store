import { useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Trash2, Upload } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTransport } from '../../../../shared/lib/transport/index';
import { useGuardedMutation } from '../../../../shared/lib/useGuardedMutation';
import type { MutationFailure } from '../../../../shared/lib/mutationError';
import { useTranslation } from '../../../../shared/i18n/index';
import { assetUrl } from '../../../../shared/lib/apiBase';
import type { ProductImage } from '../../types';
import { GALLERY_MAX_IMAGES, galleryQueryKey, moveImageIds } from '../../lib/gallery';

interface ProductGalleryManagerProps {
  productId: number;
  productName: string;
}

type Notice = { tone: 'error' | 'info'; text: string } | null;

/**
 * Additional product images, after the primary `image_url` (plan KD-8).
 *
 * Nothing is optimistic: the list only changes from a server response, so a refused
 * upload, removal or reorder leaves exactly what was there. Reordering is buttons rather
 * than drag, which is the single-pointer and keyboard path WCAG 2.5.7 asks for.
 */
export default function ProductGalleryManager({
  productId,
  productName,
}: ProductGalleryManagerProps) {
  const { t } = useTranslation();
  const transport = useTransport();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const headingId = useId();
  const fullReasonId = useId();
  const key = galleryQueryKey(productId);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await transport.request<ProductImage[]>({
        method: 'GET',
        path: `products/${productId}/images`,
      });
      return Array.isArray(data) ? data : [];
    },
  });
  const images = [...(query.data ?? [])].sort((a, b) => a.position - b.position);
  const isFull = images.length >= GALLERY_MAX_IMAGES;

  const describeFailure = (failure: MutationFailure, fallbackKey: string): string => {
    const codes = failure.details.map((d) => d.code);
    if (codes.includes('GALLERY_FULL')) {
      return t('inventory.galleryFull', { max: GALLERY_MAX_IMAGES });
    }
    if (codes.includes('IMAGE_SET_MISMATCH') || failure.kind === 'notFound') {
      // The set moved under this view; show the server's current list, not a guess.
      queryClient.invalidateQueries({ queryKey: key });
      return t('inventory.galleryStale');
    }
    if (failure.kind === 'forbidden') return t('inventory.galleryForbidden');
    if (['rateLimited', 'offline', 'network'].includes(failure.kind)) return failure.message;
    return t(fallbackKey);
  };

  const setList = (next: ProductImage[]) => queryClient.setQueryData(key, next);

  const upload = useGuardedMutation<File, ProductImage>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('image', file);
      const { data } = await transport.request<ProductImage>({
        method: 'POST',
        path: `products/${productId}/images`,
        body: form,
      });
      return data;
    },
    onSuccess: (created) => {
      setList([...images, created]);
      setNotice({ tone: 'info', text: t('inventory.galleryUploaded') });
    },
    onFailure: (failure) => {
      setNotice({ tone: 'error', text: describeFailure(failure, 'inventory.galleryUploadFailed') });
      return true;
    },
  });

  const remove = useGuardedMutation<number, unknown>({
    mutationFn: (imageId) =>
      transport.request({ method: 'DELETE', path: `products/${productId}/images/${imageId}` }),
    onSuccess: (_result, imageId) => {
      setList(images.filter((image) => image.id !== imageId));
      setNotice({ tone: 'info', text: t('inventory.galleryRemoved') });
    },
    onFailure: (failure) => {
      setNotice({ tone: 'error', text: describeFailure(failure, 'inventory.galleryRemoveFailed') });
      return true;
    },
  });

  const reorder = useGuardedMutation<{ imageIds: number[]; movedTo: number }, ProductImage[]>({
    mutationFn: async ({ imageIds }) => {
      const { data } = await transport.request<ProductImage[]>({
        method: 'PUT',
        path: `products/${productId}/images/order`,
        body: { imageIds },
      });
      return data;
    },
    onSuccess: (reordered, { movedTo }) => {
      if (Array.isArray(reordered)) setList(reordered);
      else queryClient.invalidateQueries({ queryKey: key });
      setNotice({ tone: 'info', text: t('inventory.galleryMoved', { position: movedTo }) });
    },
    onFailure: (failure) => {
      setNotice({
        tone: 'error',
        text: describeFailure(failure, 'inventory.galleryReorderFailed'),
      });
      return true;
    },
  });

  const busy = upload.isPending || remove.isPending || reorder.isPending;

  const move = (index: number, delta: -1 | 1) =>
    reorder.submit({
      imageIds: moveImageIds(
        images.map((image) => image.id),
        index,
        delta
      ),
      movedTo: index + delta + 1,
    });

  return (
    <section aria-labelledby={headingId} className="space-y-2 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 id={headingId} className="text-xs font-medium text-foreground">
            {t('inventory.gallery')}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t('inventory.galleryHelp')}</p>
        </div>
        <span className="text-xs text-muted-foreground font-data shrink-0">
          {t('inventory.galleryCount', { count: images.length, max: GALLERY_MAX_IMAGES })}
        </span>
      </div>

      {query.isLoading ? (
        <p className="text-xs text-muted-foreground">{t('inventory.galleryLoading')}</p>
      ) : query.isError ? (
        <p className="text-xs text-danger">{t('inventory.galleryLoadFailed')}</p>
      ) : images.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('inventory.galleryEmpty')}</p>
      ) : (
        <ol aria-label={t('inventory.galleryListLabel')} className="flex flex-wrap gap-3">
          {images.map((image, index) => {
            const position = index + 1;
            return (
              <li key={image.id} className="flex flex-col items-center gap-1">
                <img
                  src={assetUrl(image.image_url)}
                  alt={t('inventory.galleryImageAlt', { name: productName, position })}
                  className="h-16 w-16 rounded-lg object-cover border border-border"
                />
                <div className="flex gap-0.5">
                  <Button
                    type="button"
                    isIconOnly
                    variant="light"
                    size="sm"
                    className="h-8 w-8 min-w-8 text-muted-foreground hover:text-foreground"
                    aria-label={t('inventory.galleryMoveEarlier', { position })}
                    isDisabled={busy || index === 0}
                    onPress={() => move(index, -1)}
                  >
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    isIconOnly
                    variant="light"
                    size="sm"
                    className="h-8 w-8 min-w-8 text-muted-foreground hover:text-foreground"
                    aria-label={t('inventory.galleryMoveLater', { position })}
                    isDisabled={busy || index === images.length - 1}
                    onPress={() => move(index, 1)}
                  >
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    isIconOnly
                    variant="light"
                    color="danger"
                    size="sm"
                    className="h-8 w-8 min-w-8"
                    aria-label={t('inventory.galleryRemove', { position })}
                    isDisabled={busy}
                    onPress={() => remove.submit(image.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          ref={inputRef}
          className="hidden"
          tabIndex={-1}
          data-testid="gallery-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.submit(file);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="bordered"
          size="sm"
          startContent={<Upload className="h-3.5 w-3.5" aria-hidden="true" />}
          isDisabled={busy || isFull || query.isLoading || query.isError}
          isLoading={upload.isPending}
          aria-describedby={isFull ? fullReasonId : undefined}
          onPress={() => inputRef.current?.click()}
        >
          {t('inventory.galleryAdd')}
        </Button>
        {isFull && (
          <p id={fullReasonId} className="text-xs text-muted-foreground">
            {t('inventory.galleryFull', { max: GALLERY_MAX_IMAGES })}
          </p>
        )}
      </div>

      {/* Mounted before anything happens, so each outcome is a change it can announce. */}
      <div aria-live="polite" className="text-xs">
        {notice?.tone === 'error' && <p className="text-danger">{notice.text}</p>}
        {notice?.tone === 'info' && <p className="sr-only">{notice.text}</p>}
      </div>
    </section>
  );
}
