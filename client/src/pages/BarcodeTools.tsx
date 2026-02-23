import { useState, useCallback, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import BarcodeScanner from '../components/BarcodeScanner';
import BarcodeGenerator from '../components/BarcodeGenerator';
import { formatCurrency } from '../lib/utils';
import { useCartStore } from '../store/cartStore';
import api from '../services/api';
import { useTranslation } from '../i18n';

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: string | number;
  stock: number;
  min_stock: number;
  category: string;
  category_id: number | null;
  distributor_id: number | null;
  distributor_name: string | null;
}

export default function BarcodeTools() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [selectedForPrint, setSelectedForPrint] = useState<Set<number>>(new Set());

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products', { limit: 200 }],
    queryFn: () => api.get('/api/products', { params: { limit: 200 } }).then((r) => r.data.data),
  });

  const selectedProduct = products?.find((p) => p.id === selectedProductId);
  const filteredProducts = products?.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleBarcodeDetected = useCallback(
    async (barcode: string) => {
      try {
        const response = await api.get(`/api/products/barcode/${barcode}`);
        setScannedProduct(response.data.data as Product);
        toast.success(t('barcode.productFound'));
      } catch {
        toast.error(t('barcode.productNotFound'));
        setScannedProduct(null);
      }
    },
    [t]
  );

  const handleAddToCart = (product: Product) => {
    addItem(product);
    toast.success(t('barcode.addedToCart'));
    navigate('/pos');
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
        <p style="margin:2px 0;font-size:18px;font-weight:bold;">$${parseFloat(String(p.price)).toFixed(2)}</p>
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
      <div>
        <h1 className="text-3xl font-display tracking-wider text-foreground">
          {t('barcode.title')}
        </h1>
        <div className="gold-divider mt-2" />
      </div>

      <Tabs defaultValue="scanner">
        <TabsList>
          <TabsTrigger value="scanner">{t('barcode.scanner')}</TabsTrigger>
          <TabsTrigger value="generator">{t('barcode.generator')}</TabsTrigger>
          <TabsTrigger value="bulk">{t('barcode.bulkPrint')}</TabsTrigger>
        </TabsList>

        {/* Scanner Tab */}
        <TabsContent value="scanner" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <BarcodeScanner onDetected={handleBarcodeDetected} />

              {scannedProduct && (
                <Card className="border-gold/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground">{scannedProduct.name}</h3>
                        <p className="text-sm text-muted font-data">SKU: {scannedProduct.sku}</p>
                        <p className="text-lg font-semibold text-gold font-data mt-1">
                          {formatCurrency(Number(scannedProduct.price))}
                        </p>
                        <Badge
                          variant={scannedProduct.stock > 0 ? 'success' : 'destructive'}
                          className="mt-1"
                        >
                          {scannedProduct.stock} in stock
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button size="sm" onClick={() => handleAddToCart(scannedProduct)}>
                          {t('barcode.addToCart')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate('/inventory')}>
                          {t('barcode.viewProduct')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generator Tab */}
        <TabsContent value="generator" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <Input
                  placeholder={t('barcode.searchProduct')}
                  value={productSearch}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)}
                />
              </div>

              {productSearch && (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-md p-2">
                  {filteredProducts?.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setProductSearch('');
                      }}
                      className="w-full text-start px-3 py-2 rounded-md hover:bg-surface text-sm flex justify-between items-center"
                    >
                      <span>{p.name}</span>
                      <span className="text-muted font-data text-xs">{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedProduct && (
                <div className="space-y-4">
                  <BarcodeGenerator
                    value={selectedProduct.barcode || selectedProduct.sku}
                    product={selectedProduct}
                  />
                  <Button
                    className="gap-2"
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
                          <p style="font-size:20px;font-weight:bold;">$${parseFloat(String(selectedProduct.price)).toFixed(2)}</p>
                        </div>
                        <script>
                          try { JsBarcode("#bc","${selectedProduct.barcode || selectedProduct.sku}",{width:2,height:80,displayValue:true}); } catch(e){}
                          setTimeout(()=>window.print(),500);
                        ${'</'}script></body></html>
                      `);
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    {t('barcode.printBarcode')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Print Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted">
              {t('barcode.selected', { count: selectedForPrint.size })}
            </p>
            <Button
              className="gap-2"
              onClick={handleBulkPrint}
              disabled={selectedForPrint.size === 0}
            >
              <Printer className="h-4 w-4" />
              {t('barcode.generatePrint', { count: selectedForPrint.size })}
            </Button>
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm font-data">
              <thead>
                <tr className="bg-table-header border-b border-border">
                  <th className="px-4 py-3 w-12"></th>
                  <th className="px-4 py-3 text-start text-xs uppercase tracking-widest text-foreground">
                    {t('barcode.product')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs uppercase tracking-widest text-foreground">
                    {t('barcode.sku')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs uppercase tracking-widest text-foreground">
                    {t('barcode.barcodeCol')}
                  </th>
                  <th className="px-4 py-3 text-start text-xs uppercase tracking-widest text-foreground">
                    {t('barcode.price')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {products?.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedForPrint.has(p.id)}
                        onCheckedChange={() => togglePrintSelection(p.id)}
                      />
                    </td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3 text-muted">{p.sku}</td>
                    <td className="px-4 py-3 text-muted">{p.barcode || '-'}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(p.price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
