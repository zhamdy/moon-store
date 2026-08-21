import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import { FormField } from './FormField';
import { generateUniqueId } from '../../lib/idUtils';
import type { ImageUploaderProps, UploadedFile } from './types';

export function ImageUploader({
  value,
  onChange,
  onUpload,
  maxFiles = 5,
  accept = 'image/*',
  maxSizeBytes = 5 * 1024 * 1024, // 5MB default
  label,
  helperText,
  errorMessage,
  isInvalid,
  isDisabled = false,
  className = '',
}: ImageUploaderProps): React.JSX.Element {
  const [files, setFiles] = useState<UploadedFile[]>(() => {
    if (!value) return [];
    if (typeof value === 'string') {
      return [{ id: generateUniqueId('img'), url: value, name: 'image' }];
    }
    if (Array.isArray(value)) {
      return value.map((v) => {
        if (typeof v === 'string') {
          return { id: generateUniqueId('img'), url: v, name: 'image' };
        }
        return v;
      });
    }
    return [];
  });

  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) {
      setFiles([]);
    } else if (typeof value === 'string') {
      setFiles([{ id: generateUniqueId('img'), url: value, name: 'image' }]);
    } else if (Array.isArray(value)) {
      setFiles(
        value.map((v) =>
          typeof v === 'string' ? { id: generateUniqueId('img'), url: v, name: 'image' } : v
        )
      );
    }
  }, [value]);

  const processFiles = async (fileList: FileList | File[]) => {
    const validFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (maxSizeBytes && file.size > maxSizeBytes) {
        setStatusMessage(`Error: ${file.name} exceeds max size.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const remainingSlots = maxFiles - files.length;
    const filesToAdd = validFiles.slice(0, remainingSlots);

    const newUploadedFiles: UploadedFile[] = [];

    for (const file of filesToAdd) {
      if (onUpload) {
        try {
          const url = await onUpload(file);
          newUploadedFiles.push({
            id: generateUniqueId('img'),
            file,
            url,
            name: file.name,
            size: file.size,
          });
        } catch {
          setStatusMessage(`Error uploading ${file.name}`);
        }
      } else {
        const url = URL.createObjectURL(file);
        newUploadedFiles.push({
          id: generateUniqueId('img'),
          file,
          url,
          name: file.name,
          size: file.size,
        });
      }
    }

    const updated = maxFiles === 1 ? newUploadedFiles : [...files, ...newUploadedFiles];
    setFiles(updated);
    if (onChange) {
      onChange(updated);
    }
    setStatusMessage(`${filesToAdd.length} image(s) added successfully.`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDisabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isDisabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleRemove = (id: string) => {
    const updated = files.filter((f) => f.id !== id);
    setFiles(updated);
    if (onChange) {
      onChange(updated);
    }
    setStatusMessage('Image removed.');
  };

  const handleClickDropzone = () => {
    if (!isDisabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDownDropzone = (e: React.KeyboardEvent) => {
    if (isDisabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClickDropzone();
    }
  };

  const canUploadMore = files.length < maxFiles;

  const uploaderContent = (
    <div className={`w-full space-y-3 ${className}`}>
      {/* Live Region for Screen Readers */}
      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        disabled={isDisabled}
        onChange={handleFileSelect}
        className="hidden"
        data-testid="file-input"
      />

      {canUploadMore && (
        <div
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          onClick={handleClickDropzone}
          onKeyDown={handleKeyDownDropzone}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Upload images dropzone"
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isDragging
              ? 'border-primary bg-primary/5 scale-[0.99]'
              : isInvalid
                ? 'border-danger bg-danger/5'
                : 'border-border hover:border-foreground/40 bg-card hover:bg-muted/40'
          } ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        >
          <div className="p-3 bg-muted rounded-full mb-2 text-muted-foreground">
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">
            <span className="text-primary font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PNG, JPG, WEBP (Max {Math.round(maxSizeBytes / (1024 * 1024))}MB)
          </p>
        </div>
      )}

      {/* Gallery Previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="relative group rounded-lg border border-border bg-card overflow-hidden aspect-square flex items-center justify-center"
            >
              {file.url ? (
                <img
                  src={file.url}
                  alt={file.name || 'Uploaded image'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
              {!isDisabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(file.id)}
                  aria-label={`Remove image ${file.name}`}
                  className="absolute top-1.5 end-1.5 p-1 bg-black/60 hover:bg-danger text-white rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (label || helperText || errorMessage) {
    return (
      <FormField
        label={label}
        helperText={helperText}
        errorMessage={errorMessage}
        isInvalid={isInvalid}
        isDisabled={isDisabled}
        passPropsToChild={false}
      >
        {uploaderContent}
      </FormField>
    );
  }

  return uploaderContent;
}

export default ImageUploader;
