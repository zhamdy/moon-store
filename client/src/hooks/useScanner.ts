import { useState, useCallback, useRef } from 'react';
import Quagga from '@ericblade/quagga2';

interface UseScannerReturn {
  isScanning: boolean;
  startScanner: (targetElement: HTMLElement | string) => void;
  stopScanner: () => void;
}

export function useScanner(onDetected: (code: string) => void): UseScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<boolean>(false);

  const startScanner = useCallback(
    (targetElement: HTMLElement | string) => {
      if (isScanning) return;

      Quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            target: targetElement,
            constraints: {
              facingMode: 'environment',
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
          },
          decoder: {
            readers: [
              'ean_reader',
              'ean_8_reader',
              'code_128_reader',
              'code_39_reader',
              'upc_reader',
              'upc_e_reader',
            ],
          },
          locate: true,
          frequency: 10,
        },
        (err: unknown) => {
          if (err) {
            console.error('Scanner init error:', err);
            return;
          }
          Quagga.start();
          setIsScanning(true);
        }
      );

      Quagga.onDetected((result) => {
        if (result?.codeResult?.code) {
          onDetected(result.codeResult.code);
        }
      });

      scannerRef.current = true;
    },
    [isScanning, onDetected]
  );

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      Quagga.stop();
      scannerRef.current = false;
      setIsScanning(false);
    }
  }, []);

  return { isScanning, startScanner, stopScanner };
}
