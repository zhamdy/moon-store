import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { useSettingsStore } from '../store/settingsStore';

export default function BarcodeGenerator({ value, product }) {
  const svgRef = useRef(null);
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
          font: 'Inter',
          background: isDark ? '#141414' : '#F5F5F5',
          lineColor: isDark ? '#F5F0E8' : '#1E1E1E',
          margin: 10,
        });
      } catch {
        // Invalid barcode format
      }
    }
  }, [value, isDark]);

  return (
    <div className="text-center space-y-2 p-4 bg-surface rounded-md border border-border">
      <svg ref={svgRef} className="mx-auto" />
      {product && (
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{product.name}</p>
          <p className="text-xs text-muted font-data">SKU: {product.sku}</p>
          <p className="text-sm font-semibold text-gold font-data">
            ${parseFloat(product.price).toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
