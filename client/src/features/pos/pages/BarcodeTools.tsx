import { useState, useCallback, type ChangeEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { Tabs, Tab, Card, CardBody, Button, Input, Checkbox } from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import BarcodeScanner from '../../../shared/components/BarcodeScanner';
// eslint-disable-next-line boundaries/element-types
import BarcodeGenerator from '@/features/inventory/components/BarcodeGenerator';
import { formatCurrency } from '../../../shared/lib/utils';
import { useCartStore } from '../store/cartStore';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useProductCatalog } from '../../../shared/hooks/useProductCatalog';
import { useTransport } from '../../../shared/lib/transport/index';
import { useTranslation } from '../../../shared/i18n/index';
import type { Product } from '../../../shared/types/index';

export default function BarcodeTools() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const transport = useTransport();
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [selectedForPrint, setSelectedForPrint] = useState<Set<number>>(new Set());
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);

  const { products, hasNextPage, fetchNextPage, isFetchingNextPage } = useProductCatalog({
    search: debouncedProductSearch,
    selectedIds: [selectedProductId, ...selectedForPrint].filter((id): id is number => id !== null),
  });

  const selectedProduct = products?.find((p) => p.id === selectedProductId);

  const handleBarcodeDetected = useCallback(
    async (barcode: string) => {
      try {
        const response = await transport.request<Product>({
          method: 'GET',
          path: `products/barcode/${barcode}`,
        });
        setScannedProduct(response.data);
        toast.success(t('barcode.productFound'));
      } catch {
        toast.error(t('barcode.productNotFound'));
        setScannedProduct(null);
      }
    },
    [t, transport]
  );

  const handleAddToCart = (product: Product) => {
    addItem(product);
    toast.success(t('barcode.addedToCart'));
    navigate({ to: '/pos' });
  };

  const togglePrintSelection = (productId: number) => {
    setSelectedForPrint((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleBulkPrint = () => {
    const selectedProducts = products?.filter((p) => selectedForPrint.has(p.id));
    if (!selectedProducts?.length) {
      toast.error(t('barcode.selectToPrint'));
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const barcodeHtml = selectedProducts
      .map(
        (p) => `
      <div style="display:inline-block;width:45%;margin:2%;padding:16px;border:1px solid #ccc;text-align:center;">
        <svg id="barcode-${p.id}"></svg>
        <p style="margin:4px 0;font-weight:bold;">${p.name}</p>
        <p style="margin:2px 0;color:#666;">SKU: ${p.sku}</p>
        <p style="margin:2px 0;font-size:18px;font-weight:bold;">${formatCurrency(parseFloat(String(p.price)))}</p>
      </div>
    `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>MOON - Barcodes</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js">${'</'}script>
          <style>body{font-family:Inter,sans-serif;padding:20px;}</style>
        </head>
        <body>
          <h2 style="text-align:center;">MOON Fashion & Style - Barcodes</h2>
          ${barcodeHtml}
          <script>
            ${selectedProducts
              .map(
                (p) => `
              try { JsBarcode("#barcode-${p.id}", "${p.barcode || p.sku}", {width:2,height:60,displayValue:true,fontSize:12}); } catch(e) {}
            `
              )
              .join('\n')}
            setTimeout(() => window.print(), 500);
          ${'</'}script>
        </body>
      </html>
    `);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('barcode.title')} />

      <Tabs aria-label="Barcode tools" color="primary" variant="bordered">
        {/* Scanner Tab */}
        <Tab key="scanner" title={t('barcode.scanner')}>
          <div className="pt-4">
            <Card className="border border-border bg-card shadow-sm">
              <CardBody className="p-6 space-y-4">
                <BarcodeScanner onDetected={handleBarcodeDetected} />

                {scannedProduct && (
                  <Card className="border border-primary/30 bg-primary/5 shadow-sm">
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{scannedProduct.name}</h3>
                          <p className="text-sm text-muted-foreground font-data">
                            SKU: {scannedProduct.sku}
                          </p>
                          <p className="text-lg font-semibold text-primary font-data mt-1">
                            {formatCurrency(Number(scannedProduct.price))}
                          </p>
                          <Badge
                            size="sm"
                            variant={scannedProduct.stock > 0 ? 'success' : 'danger'}
                            className="mt-1"
                          >
                            {scannedProduct.stock} in stock
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            color="primary"
                            size="sm"
                            onClick={() => handleAddToCart(scannedProduct)}
                          >
                            {t('barcode.addToCart')}
                          </Button>
                          <Button
                            size="sm"
                            variant="bordered"
                            onClick={() => navigate({ to: '/inventory' })}
                          >
                            {t('barcode.viewProduct')}
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </CardBody>
            </Card>
          </div>
        </Tab>

        {/* Generator Tab */}
        <Tab key="generator" title={t('barcode.generator')}>
          <div className="pt-4">
            <Card className="border border-border bg-card shadow-sm">
              <CardBody className="p-6 space-y-4">
                <div>
                  <Input
                    size="sm"
                    variant="bordered"
                    placeholder={t('barcode.searchProduct')}
                    value={productSearch}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setProductSearch(e.target.value)
                    }
                  />
                </div>

                {productSearch && (
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl p-2 bg-card">
                    {products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setProductSearch('');
                        }}
                        className="w-full text-start px-3 py-2 rounded-lg hover:bg-muted/30 text-sm flex justify-between items-center transition-colors"
                      >
                        <span className="text-foreground font-medium">{p.name}</span>
                        <span className="text-muted-foreground font-data text-xs">{p.sku}</span>
                      </button>
                    ))}
                    {hasNextPage && (
                      <Button
                        fullWidth
                        variant="bordered"
                        onPress={() => void fetchNextPage()}
                        isLoading={isFetchingNextPage}
                        aria-label="Load more products"
                      >
                        Load more
                      </Button>
                    )}
                  </div>
                )}

                {selectedProduct && (
                  <div className="space-y-4">
                    <BarcodeGenerator
                      value={selectedProduct.barcode || selectedProduct.sku}
                      product={selectedProduct}
                    />
                    <Button
                      color="primary"
                      size="sm"
                      startContent={<Printer className="h-4 w-4" />}
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (!printWindow) return;
                        printWindow.document.write(`
                          <html><head><title>Barcode - ${selectedProduct.name}</title>
                          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js">${'</'}script>
                          <style>body{font-family:Inter,sans-serif;display:flex;justify-content:center;padding:40px;}</style>
                          </head><body>
                          <div style="text-align:center;">
                            <svg id="bc"></svg>
                            <p><strong>${selectedProduct.name}</strong></p>
                            <p>SKU: ${selectedProduct.sku}</p>
                            <p style="font-size:20px;font-weight:bold;">${formatCurrency(parseFloat(String(selectedProduct.price)))}</p>
                          </div>
                          <script>
                            try { JsBarcode("#bc","${selectedProduct.barcode || selectedProduct.sku}",{width:2,height:80,displayValue:true}); } catch(e){}
                            setTimeout(()=>window.print(),500);
                          ${'</'}script></body></html>
                        `);
                      }}
                    >
                      {t('barcode.printBarcode')}
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </Tab>

        {/* Bulk Print Tab */}
        <Tab key="bulk" title={t('barcode.bulkPrint')}>
          <div className="pt-4 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {t('barcode.selected', { count: selectedForPrint.size })}
              </p>
              <Button
                color="primary"
                size="sm"
                startContent={<Printer className="h-4 w-4" />}
                onClick={handleBulkPrint}
                isDisabled={selectedForPrint.size === 0}
              >
                {t('barcode.generatePrint', { count: selectedForPrint.size })}
              </Button>
            </div>
            <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
              <table className="w-full text-sm font-data">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-4 py-3 w-12"></th>
                    <th className="px-4 py-3 text-start text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      {t('barcode.product')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      {t('barcode.sku')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      {t('barcode.barcodeCol')}
                    </th>
                    <th className="px-4 py-3 text-start text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      {t('barcode.price')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Checkbox
                          isSelected={selectedForPrint.has(p.id)}
                          onValueChange={() => togglePrintSelection(p.id)}
                          size="sm"
                          aria-label={`Select ${p.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.sku}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.barcode || '-'}</td>
                      <td className="px-4 py-3 text-foreground">
                        {formatCurrency(Number(p.price))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasNextPage && (
                <div className="p-3 border-t border-border flex justify-center">
                  <Button
                    variant="bordered"
                    onPress={() => void fetchNextPage()}
                    isLoading={isFetchingNextPage}
                    aria-label="Load more products"
                  >
                    Load more
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}
