import { useRef } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

const hiddenInputClass =
  'absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]';

interface PhotoPickerProps {
  onFile: (file: File | null) => void;
  disabled?: boolean;
  /** MIME types — padrão imagens comuns */
  accept?: string;
  cameraLabel?: string;
  galleryLabel?: string;
  fileLabel?: string;
  className?: string;
}

export default function PhotoPicker({
  onFile,
  disabled = false,
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  cameraLabel = 'Tirar foto',
  galleryLabel = 'Galeria',
  fileLabel = 'Escolher foto',
  className = '',
}: PhotoPickerProps) {
  const isMobile = useIsMobile();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    onFile(file);
  };

  const btnClass =
    'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-olive disabled:cursor-not-allowed disabled:opacity-60';

  if (isMobile) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        <label className={btnClass}>
          <Camera className="h-4 w-4" />
          {cameraLabel}
          <input
            ref={cameraRef}
            type="file"
            accept={accept}
            capture="environment"
            disabled={disabled}
            className={hiddenInputClass}
            onChange={onChange}
          />
        </label>
        <label className={btnClass}>
          <ImagePlus className="h-4 w-4" />
          {galleryLabel}
          <input
            ref={galleryRef}
            type="file"
            accept={accept}
            disabled={disabled}
            className={hiddenInputClass}
            onChange={onChange}
          />
        </label>
      </div>
    );
  }

  return (
    <div className={className}>
      <label className={btnClass}>
        {fileLabel}
        <input
          ref={galleryRef}
          type="file"
          accept={accept}
          disabled={disabled}
          className={hiddenInputClass}
          onChange={onChange}
        />
      </label>
    </div>
  );
}
