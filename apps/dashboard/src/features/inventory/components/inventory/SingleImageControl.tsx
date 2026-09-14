import { useRef } from 'react';
import { Upload, Trash2, ImagePlus } from 'lucide-react';
import { Button } from '@heroui/react';
import { useTranslation } from '../../../../shared/i18n/index';
import { assetUrl } from '../../../../shared/lib/apiBase';

interface SingleImageControlProps {
  label: string;
  imageUrl: string | null | undefined;
  alt: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

/**
 * One replaceable image with upload and remove: the product's primary image and a
 * collection's image. Rendered only once the record exists, since both upload routes
 * address it by id.
 */
export default function SingleImageControl({
  label,
  imageUrl,
  alt,
  onUpload,
  onRemove,
}: SingleImageControlProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <img
            src={assetUrl(imageUrl)}
            alt={alt}
            className="h-16 w-16 rounded-lg object-cover border border-border"
          />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-muted/30 flex items-center justify-center border border-dashed border-border">
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            ref={inputRef}
            className="hidden"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="bordered"
            size="sm"
            startContent={<Upload className="h-3.5 w-3.5" />}
            onPress={() => inputRef.current?.click()}
          >
            {t('inventory.uploadImage')}
          </Button>
          {imageUrl && (
            <Button
              type="button"
              variant="light"
              color="danger"
              size="sm"
              startContent={<Trash2 className="h-3.5 w-3.5" />}
              onPress={onRemove}
            >
              {t('inventory.removeImage')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
