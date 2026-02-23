import { useState, useCallback, useRef } from 'react';
import Quagga from '@ericblade/quagga2';

export function useScanner(onDetected) {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);

  const startScanner = useCallback((targetElement) => {
    if (isScanning) return;

    Quagga.init(
      {
        inputStream: {
          name: 'Live',
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
      (err) => {
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
  }, [isScanning, onDetected]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      Quagga.stop();
      scannerRef.current = false;
      setIsScanning(false);
    }
  }, []);

  return { isScanning, startScanner, stopScanner };
}
