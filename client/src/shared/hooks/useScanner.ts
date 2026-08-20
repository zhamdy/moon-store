import { useState, useCallback, useRef } from 'react';
import Quagga from '@ericblade/quagga2';

interface UseScannerReturn {
  isScanning: boolean;
  startScanner: (targetElement: HTMLElement) => void;
  stopScanner: () => void;
}

const COOLDOWN_MS = 2000;

export function useScanner(onDetected: (code: string) => void): UseScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<boolean>(false);
  const lastCodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  const startScanner = useCallback(
    (targetElement: HTMLElement) => {
      if (scannerRef.current) return;
      scannerRef.current = true;

      // Ensure the container has explicit dimensions before Quagga reads them
      const rect = targetElement.getBoundingClientRect();
      const w = Math.max(rect.width, 320);
      const h = Math.max(rect.height, 240);
      targetElement.style.width = w + 'px';
      targetElement.style.height = h + 'px';

      Quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            target: targetElement,
            constraints: {
              facingMode: 'environment',
              width: 640,
              height: 480,
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
          numOfWorkers: 0,
          locate: false,
          frequency: 10,
        },
        (err: unknown) => {
          if (err) {
            console.error('Scanner init error:', err);
            scannerRef.current = false;
            return;
          }
          Quagga.start();
          setIsScanning(true);
        }
      );

      Quagga.onDetected((result) => {
        const code = result?.codeResult?.code;
        if (!code) return;

        const now = Date.now();
        // Ignore same code within cooldown period
        if (code === lastCodeRef.current && now - lastTimeRef.current < COOLDOWN_MS) {
          return;
        }

        lastCodeRef.current = code;
        lastTimeRef.current = now;
        onDetected(code);
      });
    },
    [onDetected]
  );

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      Quagga.stop();
      scannerRef.current = false;
      setIsScanning(false);
      lastCodeRef.current = '';
      lastTimeRef.current = 0;
    }
  }, []);

  return { isScanning, startScanner, stopScanner };
}
