import { useEffect, useRef } from 'react';
import { useScanner } from '../hooks/useScanner';
import { useTranslation } from '../i18n';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
}

export default function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const { isScanning, startScanner, stopScanner } = useScanner(onDetected);
  const { t } = useTranslation();

  useEffect(() => {
    if (scannerRef.current) {
      startScanner(scannerRef.current);
    }
    return () => stopScanner();
  }, [startScanner, stopScanner]);

  return (
    <div className="relative">
      <div
        ref={scannerRef}
        className="w-full h-64 bg-surface overflow-hidden"
        style={{ position: 'relative' }}
      />
      {isScanning && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-surface/90 px-3 py-1 rounded text-xs text-gold font-data">
          {t('pos.scanning')}
        </div>
      )}
    </div>
  );
}
